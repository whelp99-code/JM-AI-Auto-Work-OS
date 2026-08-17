import json
from pathlib import Path

from app.ingest import import_ai_export, scan_files


def test_scan_files_reads_supported_text(tmp_path: Path) -> None:
    (tmp_path / "a.md").write_text("hello")
    (tmp_path / "ignore.bin").write_bytes(b"x")
    items = list(scan_files(tmp_path))
    assert len(items) == 1
    assert items[0].title == "a.md"
    assert items[0].body == "hello"


def test_ai_export_import_is_tolerant(tmp_path: Path) -> None:
    export = tmp_path / "conversations.json"
    export.write_text(json.dumps([{"id": "c1", "title": "Test", "messages": [{"content": "hello"}]}]))
    items = list(import_ai_export(export, "chatgpt"))
    assert len(items) == 1
    assert items[0].source_id == "c1"
    assert "hello" in items[0].body


def test_malformed_export_is_skipped(tmp_path: Path) -> None:
    export = tmp_path / "broken.json"
    export.write_text("{broken")
    assert list(import_ai_export(export, "claude")) == []
