from __future__ import annotations

import os
from dataclasses import replace
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from app.connectors import GmailConnector, GoogleCalendarConnector, MicrosoftGraphConnector
from app.core import Item, ProjectRule, classify_project
from app.db import Repository
from app.ingest import import_ai_export, scan_files

app = FastAPI(title="JM Personal Data OS", version="0.1.0")
repo = Repository(
    os.environ.get(
        "DATABASE_URL",
        "postgresql://postgres:postgres@127.0.0.1:5432/jm_data_os",
    )
)


class PathIngestRequest(BaseModel):
    path: str


class AIExportRequest(BaseModel):
    path: str
    provider: str


class ProjectRuleRequest(BaseModel):
    project: str = Field(min_length=1, max_length=200)
    keywords: list[str] = Field(min_length=1, max_length=100)
    priority: int = Field(default=0, ge=-1000, le=1000)


class GoogleCalendarSyncRequest(BaseModel):
    calendar_id: str = "primary"


class MicrosoftSyncRequest(BaseModel):
    folder_id: str = "inbox"
    calendar_start: str | None = None
    calendar_end: str | None = None


@app.on_event("startup")
def startup() -> None:
    repo.migrate()


def _classify(item: Item) -> tuple[Item, dict[str, Any]]:
    project, confidence, reason = classify_project(item.title, item.body, repo.list_project_rules())
    return replace(item, project=project), {
        "classification": {"project": project, "confidence": confidence, "reason": reason}
    }


def _store(items: list[Item]) -> int:
    imported = 0
    for item in items:
        classified, metadata = _classify(item)
        repo.upsert_item(classified, metadata)
        imported += 1
    return imported


def _required_token(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise HTTPException(status_code=503, detail=f"{name} is not configured")
    return value


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


@app.post("/v1/ingest/filesystem")
def ingest_filesystem(request: PathIngestRequest) -> dict[str, int]:
    root = Path(request.path)
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=400, detail="configured root does not exist")
    return {"imported": _store(list(scan_files(root)))}


@app.post("/v1/ingest/ai-export")
def ingest_ai_export(request: AIExportRequest) -> dict[str, int]:
    path = Path(request.path)
    if not path.exists():
        raise HTTPException(status_code=400, detail="export path does not exist")
    try:
        return {"imported": _store(list(import_ai_export(path, request.provider)))}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/v1/sync/gmail")
def sync_gmail() -> dict[str, int]:
    token = _required_token("GMAIL_ACCESS_TOKEN")
    items = list(GmailConnector(token).iter_messages())
    imported = _store(items)
    repo.save_source_state("gmail", "gmail:me", "gmail://me", {"mode": "full-idempotent"})
    return {"imported": imported}


@app.post("/v1/sync/google-calendar")
def sync_google_calendar(request: GoogleCalendarSyncRequest) -> dict[str, int]:
    token = _required_token("GOOGLE_CALENDAR_ACCESS_TOKEN")
    source_key = f"google-calendar:{request.calendar_id}"
    state = repo.get_source_state(source_key)
    sync_token = state.get("sync_token")
    connector = GoogleCalendarConnector(token)
    try:
        items, next_token = connector.sync_events(
            request.calendar_id,
            str(sync_token) if sync_token else None,
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != 410:
            raise HTTPException(status_code=502, detail="Google Calendar sync failed") from exc
        items, next_token = connector.sync_events(request.calendar_id, None)
    imported = _store(items)
    repo.save_source_state(
        "google-calendar",
        source_key,
        f"gcal://{request.calendar_id}",
        {"sync_token": next_token} if next_token else {},
    )
    return {"imported": imported}


@app.post("/v1/sync/microsoft")
def sync_microsoft(request: MicrosoftSyncRequest) -> dict[str, int]:
    token = _required_token("MICROSOFT_GRAPH_ACCESS_TOKEN")
    connector = MicrosoftGraphConnector(token)
    mail_key = f"microsoft-mail:{request.folder_id}"
    mail_state = repo.get_source_state(mail_key)
    mail_items, mail_delta = connector.iter_mail_folder_delta(
        request.folder_id,
        str(mail_state.get("delta_url")) if mail_state.get("delta_url") else None,
    )
    imported = _store(mail_items)
    repo.save_source_state(
        "outlook",
        mail_key,
        f"outlook://folder/{request.folder_id}",
        {"delta_url": mail_delta} if mail_delta else {},
    )

    calendar_imported = 0
    if request.calendar_start and request.calendar_end:
        calendar_key = f"microsoft-calendar:{request.calendar_start}:{request.calendar_end}"
        calendar_state = repo.get_source_state(calendar_key)
        calendar_items, calendar_delta = connector.iter_calendar_delta(
            request.calendar_start,
            request.calendar_end,
            str(calendar_state.get("delta_url")) if calendar_state.get("delta_url") else None,
        )
        calendar_imported = _store(calendar_items)
        repo.save_source_state(
            "microsoft-calendar",
            calendar_key,
            "outlook://calendar",
            {"delta_url": calendar_delta} if calendar_delta else {},
        )
    return {"mail_imported": imported, "calendar_imported": calendar_imported}


@app.post("/v1/projects/rules")
def save_project_rule(request: ProjectRuleRequest) -> dict[str, str]:
    normalized = tuple(keyword.strip() for keyword in request.keywords if keyword.strip())
    if not normalized:
        raise HTTPException(status_code=400, detail="at least one non-empty keyword is required")
    repo.save_project_rule(ProjectRule(request.project.strip(), normalized, request.priority))
    return {"status": "saved", "project": request.project.strip()}


@app.get("/v1/search")
def search(
    q: str = Query(min_length=1),
    source: str | None = None,
    project: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict[str, Any]]:
    return repo.search(q, source=source, project=project, limit=limit)


@app.get("/v1/items/{item_id}")
def get_item(item_id: int) -> dict[str, Any]:
    item = repo.get_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="item not found")
    return item


@app.get("/v1/duplicates")
def duplicates() -> list[dict[str, Any]]:
    return repo.duplicates()
