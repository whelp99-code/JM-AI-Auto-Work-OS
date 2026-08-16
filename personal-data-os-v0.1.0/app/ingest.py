from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Iterable

from app.core import Item, ensure_within_root, read_text_bounded

TEXT_EXTENSIONS = {".txt", ".md", ".json", ".csv", ".html", ".htm"}


def scan_files(root: Path) -> Iterable[Item]:
    resolved_root = root.resolve(strict=True)
    for candidate in resolved_root.rglob("*"):
        if not candidate.is_file() or candidate.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        safe = ensure_within_root(resolved_root, candidate)
        try:
            body = read_text_bounded(safe)
        except (OSError, ValueError):
            continue
        yield Item(
            source_type="filesystem",
            source_id=str(safe),
            locator=str(safe),
            title=safe.name,
            body=body,
        )


def _flatten_messages(value: object) -> list[str]:
    texts: list[str] = []
    if isinstance(value, str):
        if value.strip():
            texts.append(value)
    elif isinstance(value, list):
        for item in value:
            texts.extend(_flatten_messages(item))
    elif isinstance(value, dict):
        for key in ("text", "content", "parts", "message", "messages", "mapping"):
            if key in value:
                texts.extend(_flatten_messages(value[key]))
    return texts


def import_ai_export(path: Path, provider: str) -> Iterable[Item]:
    provider = provider.casefold()
    if provider not in {"chatgpt", "claude", "gemini"}:
        raise ValueError("unsupported provider")
    if path.is_dir():
        files = sorted(path.rglob("*.json"))
    else:
        files = [path]
    for file_path in files:
        try:
            payload = json.loads(read_text_bounded(file_path, max_bytes=20_000_000))
        except (OSError, ValueError, json.JSONDecodeError):
            continue
        records = payload if isinstance(payload, list) else [payload]
        for index, record in enumerate(records):
            if not isinstance(record, dict):
                continue
            title = str(record.get("title") or record.get("name") or f"{provider}-{index}")
            body = "\n".join(_flatten_messages(record))
            if not body.strip():
                body = json.dumps(record, ensure_ascii=False, sort_keys=True)
            source_id = str(record.get("id") or record.get("uuid") or f"{file_path}:{index}")
            yield Item(
                source_type=f"ai-export:{provider}",
                source_id=source_id,
                locator=str(file_path),
                title=title,
                body=body,
            )
