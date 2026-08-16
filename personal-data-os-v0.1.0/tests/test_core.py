from pathlib import Path

import pytest

from app.core import Item, ProjectRule, classify_project, ensure_within_root


def test_content_hash_is_deterministic() -> None:
    a = Item("x", "1", "x://1", "t", "same")
    b = Item("y", "2", "y://2", "t2", "same")
    assert a.content_hash == b.content_hash


def test_project_classification() -> None:
    project, confidence, reason = classify_project(
        "HCI SIEM design",
        "Fortinet log retention",
        [ProjectRule("SIEM", ("fortinet", "siem"), 10)],
    )
    assert project == "SIEM"
    assert confidence >= 0.6
    assert "matched" in reason


def test_unclassified_fallback() -> None:
    assert classify_project("hello", "world", []) == ("unclassified", 0.0, "no project rule matched")


def test_path_escape_is_rejected(tmp_path: Path) -> None:
    root = tmp_path / "root"
    root.mkdir()
    inside = root / "inside.txt"
    inside.write_text("ok")
    outside = tmp_path / "outside.txt"
    outside.write_text("no")
    assert ensure_within_root(root, inside) == inside.resolve()
    with pytest.raises(ValueError):
        ensure_within_root(root, outside)
