import os

from app.core import Item, ProjectRule
from app.db import Repository


def repository() -> Repository:
    return Repository(os.environ["DATABASE_URL"])


def reset(repo: Repository) -> None:
    repo.migrate()
    with repo.connect() as conn:
        conn.execute(
            "TRUNCATE items, sources, ingest_runs, project_rules RESTART IDENTITY CASCADE"
        )


def test_idempotent_upsert_search_provenance_and_duplicates() -> None:
    repo = repository()
    reset(repo)
    first = Item("fixture", "one", "fixture://one", "SIEM Plan", "Fortinet logs")
    first_id = repo.upsert_item(first)
    second_id = repo.upsert_item(first)
    assert first_id == second_id
    repo.upsert_item(Item("fixture", "two", "fixture://two", "Copy", "Fortinet logs"))

    results = repo.search("Fortinet")
    assert results
    assert results[0]["locator"].startswith("fixture://")

    duplicates = repo.duplicates()
    assert len(duplicates) == 1
    assert duplicates[0]["count"] == 2


def test_source_state_and_project_rules_round_trip() -> None:
    repo = repository()
    reset(repo)
    repo.save_source_state(
        "google-calendar",
        "google-calendar:primary",
        "gcal://primary",
        {"sync_token": "abc"},
    )
    assert repo.get_source_state("google-calendar:primary")["sync_token"] == "abc"

    repo.save_project_rule(ProjectRule("SIEM", ("fortinet", "ndr"), priority=10))
    rules = repo.list_project_rules()
    assert rules == [ProjectRule("SIEM", ("fortinet", "ndr"), priority=10)]
