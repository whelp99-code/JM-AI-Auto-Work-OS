from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

from app.db import Repository
from app.ingest import import_ai_export, scan_files

app = FastAPI(title="JM Personal Data OS", version="0.1.0")
repo = Repository(os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5432/jm_data_os"))


class PathIngestRequest(BaseModel):
    path: str


class AIExportRequest(BaseModel):
    path: str
    provider: str


@app.on_event("startup")
def startup() -> None:
    repo.migrate()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


@app.post("/v1/ingest/filesystem")
def ingest_filesystem(request: PathIngestRequest) -> dict[str, int]:
    root = Path(request.path)
    if not root.exists() or not root.is_dir():
        raise HTTPException(status_code=400, detail="configured root does not exist")
    imported = 0
    for item in scan_files(root):
        repo.upsert_item(item)
        imported += 1
    return {"imported": imported}


@app.post("/v1/ingest/ai-export")
def ingest_ai_export(request: AIExportRequest) -> dict[str, int]:
    path = Path(request.path)
    if not path.exists():
        raise HTTPException(status_code=400, detail="export path does not exist")
    imported = 0
    try:
        for item in import_ai_export(path, request.provider):
            repo.upsert_item(item)
            imported += 1
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"imported": imported}


@app.get("/v1/search")
def search(
    q: str = Query(min_length=1),
    source: str | None = None,
    project: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[dict[str, object]]:
    return repo.search(q, source=source, project=project, limit=limit)


@app.get("/v1/items/{item_id}")
def get_item(item_id: int) -> dict[str, object]:
    item = repo.get_item(item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="item not found")
    return item


@app.get("/v1/duplicates")
def duplicates() -> list[dict[str, object]]:
    return repo.duplicates()
