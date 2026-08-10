# Mobile Suite v0.8.0 — Orphaned Build Cache Disposal Receipt

## Status

Commit `7950434` (chore: deprecate mobile-suite v0.8.0 snapshot + remove committed zip/whl binaries) removed the 250 tracked
entries under `jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/`. `git rm` only removes tracked files, so the local, already
gitignored build/runtime byproducts left in that same directory by prior `pip install -e .` / `pytest` / `swift build` runs
were not touched and remained on disk. Because the directory no longer had any tracked files, it re-surfaced as an untracked
top-level entry (`?? jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/`) in `git status`, which is what this receipt disposes of.

## What was actually in the untracked directory

Full inventory before disposal: **6,688 files, 239 MB**. Category breakdown:

| Category | Path | Files | Size |
|---|---|---|---|
| Python virtualenv | `server/.venv/` | 5,161 | 132 MB |
| Swift Package build cache | `ios/Packages/ActionHubCore/.build/` | 1,429 | 105 MB |
| Python bytecode cache | `**/__pycache__/` | 2,082 | small |
| pytest cache | `server/.pytest_cache/` | 4 | small |
| ruff cache | `server/.ruff_cache/` | 5 | small |
| pip egg-info | `server/jm_ai_action_hub.egg-info/` | 6 | small |
| Test coverage DB | `server/.coverage` | 1 | 76 KB |
| Runtime SQLite DB | `server/data/action_hub.db` | 1 | 484 KB |
| Empty markers | `server/data/.gitkeep`, `server/data/exports/.gitkeep` | 2 | 0 |

**Verified: zero `.py` or `.swift` source files exist anywhere in the tree.** An explicit recursive search for files outside
`.venv/`, `.build/`, `__pycache__/`, `.pytest_cache/`, `.ruff_cache/`, and `*.egg-info/` returned only `.coverage`, the two
`.gitkeep` markers, `action_hub.db`, and the egg-info metadata text files — no application code. This is a 100% ephemeral,
machine-reproducible build/dev-environment cache, not a source snapshot.

## Comparison against JM-AI Action Hub (evidence preservation check)

Per commit `f3d0193` ("receive Action Hub v0.8.0 evidence from Auto Work OS deprecation"), the Action Hub repository already
holds the processed verification evidence for this same v0.8.0 release at
`jm-ai-action-hub-focus-suite-v0.9.0-ios-v0.2.1/evidence/v0.8.0/` (OpenAPI spec, pytest/coverage reports, migration
before/after JSON, pairing and mobile-smoke summaries, release commit log — 13 files, 7,033 lines).

A file-level identity check against the untracked AWOS directory is not applicable in the sense of matching identical bytes,
because the two sides hold different artifact types by design:

- AWOS side (this directory): raw, binary, machine-local build/runtime state (`.venv` site-packages, `.build` object files,
  `.pyc` bytecode, a raw `.coverage` SQLite DB, a raw `action_hub.db` runtime DB). None of this is source and none of it is
  meant to be portable between machines.
- Action Hub side (`evidence/v0.8.0/`): human-readable, processed reports derived from those same test/build runs
  (`server-pytest.txt`, `server-coverage.json`, `migration-v070-pre.json`, `migration-v080-post.json`, etc.).

Since the AWOS directory contains no source code and no artifact that has a byte-identical counterpart to preserve, there is
no migration gap. Everything of evidentiary or source value from the v0.8.0 mobile suite was already either committed to
Action Hub's `evidence/v0.8.0/` (via `f3d0193`) or was tracked source already removed from AWOS in `7950434` (recoverable from
that commit's parent, `9c72405`, and from `main`, if ever needed).

## Disposition

Per the hard-to-reverse-action policy (prefer move over delete), the directory was **moved, not deleted**:

- Moved from: `JM-AI Auto Work OS/jm-ai-action-hub-mobile-suite-v0.8.0-ios-v0.1.0/`
- Moved to: `JM AI-OS Pack/_archive/awos-mobile-suite-v0.8.0-2026-08-05/`
- File count and total size at destination verified identical to source: 6,688 files, 239 MB.

No files were edited. No existing tracked file in this repository was modified as part of this disposal — only this new
receipt document was added.

## Verification

```
$ git status --porcelain   # in JM-AI Auto Work OS, before adding this receipt
(empty)
```

The repository has no remaining untracked or modified entries related to the mobile-suite v0.8.0 snapshot.
