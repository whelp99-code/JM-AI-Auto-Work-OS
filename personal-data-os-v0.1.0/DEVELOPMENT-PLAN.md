# JM Personal Data OS v0.1.0 — Development Plan

Status: **DEVELOPMENT READY / IN REVIEW**

## Profile
- Profile B: Internal production system
- Overlay D: AI / Automation, limited to deterministic project classification in v0.1.0

## Chain
WHY → WHAT → HOW → BUILD → VERIFY → RELEASE → OPERATE → LEARN

## Goals
- GOAL-001: ≥95% supported validation corpus ingestion without silent loss.
- GOAL-002: 100% indexed items retain source provenance.
- GOAL-003: exact duplicate detection has 100% precision for identical content/bytes in validation fixtures.
- GOAL-004: unified lexical search across normalized item types.
- GOAL-005: backup → clean database → restore reproduces application state.
- GOAL-006: cloud connectors require read-only access only.

## v0.1.0 requirements
- REQ-FUNC-001 Local/NAS file ingestion.
- REQ-FUNC-002 Gmail read-only import.
- REQ-FUNC-003 Outlook read-only import.
- REQ-FUNC-004 Google and Microsoft calendar read-only import.
- REQ-FUNC-005 ChatGPT/Claude/Gemini export import.
- REQ-FUNC-006 Canonical Item store.
- REQ-FUNC-007 Unified search.
- REQ-FUNC-008 Provenance retrieval.
- REQ-FUNC-009 Exact duplicate grouping.
- REQ-FUNC-010 Deterministic project classification with confidence/reason.
- REQ-FUNC-011 Local backup/restore with checksum verification.

## Security requirements
- REQ-SEC-001 Least-privilege read-only connectors.
- REQ-SEC-002 Secrets external to git.
- REQ-SEC-003 Scanner cannot read outside configured filesystem root.
- REQ-SEC-004 Backups use restrictive permissions and checksums.
- REQ-SEC-005 API binds to localhost by documented default.

## Architecture
- ARCH-001 FastAPI service.
- ARCH-002 PostgreSQL + FTS + pg_trgm.
- ARCH-003 Canonical idempotent upsert pipeline.
- ARCH-004 Bounded local/NAS scanner.
- ARCH-005 Gmail list→get adapter.
- ARCH-006 Google Calendar sync-token adapter.
- ARCH-007 Microsoft Graph mail/calendar delta adapter.
- ARCH-008 Search/provenance service.
- ARCH-009 SHA-256 exact deduplication.
- ARCH-010 deterministic project classifier.
- ARCH-011 pg_dump/pg_restore backup verification.

## Certainty
- DECIDED: PostgreSQL is canonical state store.
- DECIDED: lexical FTS/trigram search precedes semantic/vector search.
- DECIDED: exact dedupe only; fuzzy merge deferred.
- DECIDED: no external source mutations in v0.1.0.
- ASSUMED: NAS is mounted as a normal local filesystem path.
- UNKNOWN: exact NAS mount paths.
- UNKNOWN: production OAuth client configuration.
- UNKNOWN: real-world export schema variants beyond fixtures.
- UNKNOWN: HCI production capacity sizing.

## Waves / Linear
- WAVE-01 → WHE-18 Foundation & canonical data model.
- WAVE-02 → WHE-19 Local/NAS + AI export ingestion.
- WAVE-03 → WHE-20 Search, provenance, classification.
- WAVE-04 → WHE-21 Gmail/Outlook/Calendar read-only connectors.
- WAVE-05 → WHE-22 Backup, adversarial validation, release gate.

## Release evidence
- TEST-001 idempotent upsert.
- TEST-002 exact SHA-256 duplicate grouping.
- TEST-003 traversal/symlink boundary.
- TEST-004 PostgreSQL search + provenance.
- TEST-005 malformed import isolation.
- TEST-006 Gmail contract.
- TEST-007 Google/Microsoft incremental cursor contract.
- TEST-008 no secret logging / no write methods.
- TEST-009 backup/restore proof.
- TEST-010 mixed ingest/search/provenance E2E.
- TEST-011 same-SHA regression.

## Release gate
MVP READY requires all applicable CI checks and acceptance evidence on one commit SHA, no release-blocking defects, verified backup/restore, reproducible install/run instructions, and documented live-pilot limitations. Production Ready is deferred until live OAuth/NAS pilot and HCI sizing are complete.
