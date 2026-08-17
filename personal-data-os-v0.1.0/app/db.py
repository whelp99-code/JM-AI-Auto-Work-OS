from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

import psycopg
from psycopg.rows import dict_row

from app.core import Item, ProjectRule

SCHEMA = """
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS sources (
  id BIGSERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  locator TEXT NOT NULL,
  sync_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS items (
  id BIGSERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  locator TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL,
  project TEXT NOT NULL DEFAULT 'unclassified',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_items_hash ON items(content_hash);
CREATE INDEX IF NOT EXISTS idx_items_project ON items(project);
CREATE INDEX IF NOT EXISTS idx_items_fts ON items USING GIN(
  to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body,''))
);
CREATE INDEX IF NOT EXISTS idx_items_title_trgm ON items USING GIN(title gin_trgm_ops);
CREATE TABLE IF NOT EXISTS ingest_runs (
  id BIGSERIAL PRIMARY KEY,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  imported INTEGER NOT NULL DEFAULT 0,
  skipped INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS project_rules (
  id BIGSERIAL PRIMARY KEY,
  project TEXT NOT NULL UNIQUE,
  keywords JSONB NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0
);
"""


@dataclass
class Repository:
    dsn: str

    def connect(self) -> psycopg.Connection[dict[str, Any]]:
        return psycopg.connect(self.dsn, row_factory=dict_row)

    def migrate(self) -> None:
        with self.connect() as conn:
            conn.execute(SCHEMA)

    def upsert_item(self, item: Item, metadata: dict[str, Any] | None = None) -> int:
        sql = """
        INSERT INTO items(source_type, source_id, locator, title, body, content_hash, project, metadata)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
        ON CONFLICT(source_type, source_id) DO UPDATE SET
          locator=EXCLUDED.locator, title=EXCLUDED.title, body=EXCLUDED.body,
          content_hash=EXCLUDED.content_hash, project=EXCLUDED.project,
          metadata=EXCLUDED.metadata, updated_at=now()
        RETURNING id
        """
        values = (
            item.source_type,
            item.source_id,
            item.locator,
            item.title,
            item.body,
            item.content_hash,
            item.project,
            json.dumps(metadata or {}),
        )
        with self.connect() as conn:
            row = conn.execute(sql, values).fetchone()
            assert row is not None
            return int(row["id"])

    def search(
        self,
        query: str,
        source: str | None = None,
        project: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        clauses = [
            """(
              to_tsvector('simple', title || ' ' || body) @@ plainto_tsquery('simple', %s)
              OR similarity(title, %s) > 0.2
              OR title ILIKE '%%' || %s || '%%'
              OR body ILIKE '%%' || %s || '%%'
            )"""
        ]
        params: list[Any] = [query, query, query, query]
        if source is not None:
            clauses.append("source_type=%s")
            params.append(source)
        if project is not None:
            clauses.append("project=%s")
            params.append(project)
        params.append(limit)
        sql = f"""
        SELECT id, source_type, source_id, locator, title, project, content_hash,
               ts_rank(
                 to_tsvector('simple', title || ' ' || body),
                 plainto_tsquery('simple', %s)
               ) AS rank
        FROM items
        WHERE {' AND '.join(clauses)}
        ORDER BY rank DESC, updated_at DESC
        LIMIT %s
        """
        params.insert(0, query)
        with self.connect() as conn:
            return list(conn.execute(sql, params).fetchall())

    def get_item(self, item_id: int) -> dict[str, Any] | None:
        with self.connect() as conn:
            return conn.execute("SELECT * FROM items WHERE id=%s", (item_id,)).fetchone()

    def duplicates(self) -> list[dict[str, Any]]:
        with self.connect() as conn:
            return list(
                conn.execute(
                    """
                    SELECT content_hash, count(*) AS count, array_agg(id ORDER BY id) AS item_ids
                    FROM items
                    GROUP BY content_hash
                    HAVING count(*) > 1
                    ORDER BY count(*) DESC
                    """
                ).fetchall()
            )

    def save_source_state(
        self,
        source_type: str,
        source_key: str,
        locator: str,
        state: dict[str, Any],
    ) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO sources(source_type, source_key, locator, sync_state)
                VALUES (%s,%s,%s,%s::jsonb)
                ON CONFLICT(source_key) DO UPDATE SET
                  source_type=EXCLUDED.source_type,
                  locator=EXCLUDED.locator,
                  sync_state=EXCLUDED.sync_state,
                  updated_at=now()
                """,
                (source_type, source_key, locator, json.dumps(state)),
            )

    def get_source_state(self, source_key: str) -> dict[str, Any]:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT sync_state FROM sources WHERE source_key=%s", (source_key,)
            ).fetchone()
        if row is None:
            return {}
        value = row["sync_state"]
        return dict(value) if isinstance(value, dict) else {}

    def save_project_rule(self, rule: ProjectRule) -> None:
        with self.connect() as conn:
            conn.execute(
                """
                INSERT INTO project_rules(project, keywords, priority)
                VALUES (%s,%s::jsonb,%s)
                ON CONFLICT(project) DO UPDATE SET
                  keywords=EXCLUDED.keywords,
                  priority=EXCLUDED.priority
                """,
                (rule.project, json.dumps(list(rule.keywords)), rule.priority),
            )

    def list_project_rules(self) -> list[ProjectRule]:
        with self.connect() as conn:
            rows = conn.execute(
                "SELECT project, keywords, priority FROM project_rules ORDER BY priority DESC, project"
            ).fetchall()
        rules: list[ProjectRule] = []
        for row in rows:
            raw_keywords = row["keywords"]
            keywords = (
                tuple(str(value) for value in raw_keywords)
                if isinstance(raw_keywords, list)
                else ()
            )
            rules.append(
                ProjectRule(
                    project=str(row["project"]),
                    keywords=keywords,
                    priority=int(row["priority"]),
                )
            )
        return rules
