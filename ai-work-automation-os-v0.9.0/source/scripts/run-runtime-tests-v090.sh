#!/usr/bin/env bash
set -euo pipefail

ROOT="${AIWA_RUNTIME_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ROOT="$(cd -P "$ROOT" && pwd)"
DEFAULT_DATABASE_URL="file:../data/test-v0.9.0.db"
DATABASE_URL_FOR_TESTS="${AIWA_TEST_DATABASE_URL:-$DEFAULT_DATABASE_URL}"
explicit_database_url=0
[[ -n "${AIWA_TEST_DATABASE_URL+x}" ]] && explicit_database_url=1
die() { echo "$1" >&2; exit 64; }
if [[ "$DATABASE_URL_FOR_TESTS" != file:* || "${DATABASE_URL_FOR_TESTS#file:}" == "$DATABASE_URL_FOR_TESTS" || -z "${DATABASE_URL_FOR_TESTS#file:}" ]]; then
  die "AIWA_TEST_DATABASE_URL must be a file: URL with a non-empty path"
fi
database_path="${DATABASE_URL_FOR_TESTS#file:}"
[[ "$database_path" != *'?'* && "$database_path" != *'#'* ]] || die "AIWA_TEST_DATABASE_URL must not contain query or fragment data"
if [[ "$explicit_database_url" -eq 0 ]]; then
  [[ "$DATABASE_URL_FOR_TESTS" == "$DEFAULT_DATABASE_URL" && "$(basename "$database_path")" == "test-v0.9.0.db" ]] || die "default test database URL mismatch"
  default_parent="$ROOT/data"
  canonical_database="$default_parent/test-v0.9.0.db"
  [[ ! -L "$default_parent" && ! -L "$canonical_database" ]] || die "default test database must not use a symlink"
  if [[ -e "$default_parent" ]]; then
    [[ -d "$default_parent" ]] || die "default test database parent must be a directory"
    [[ "$(cd -P "$default_parent" && pwd)" == "$default_parent" ]] || die "default test database parent escaped source root"
  fi
else
  [[ "$database_path" = /* ]] || die "AIWA_TEST_DATABASE_URL must use an absolute file path"
  candidate_path="$database_path"
  parent_path="$(dirname "$candidate_path")"
  [[ -d "$parent_path" ]] || die "AIWA_TEST_DATABASE_URL parent directory must exist"
  [[ ! -L "$candidate_path" ]] || die "AIWA_TEST_DATABASE_URL must not be a symlink"
  logical_parent="$(cd "$parent_path" && pwd -L)"
  physical_parent="$(cd -P "$parent_path" && pwd)"
  physical_database="$physical_parent/$(basename "$candidate_path")"
  temporary_logical_root="$(cd "${TMPDIR:-/tmp}" && pwd -L)"
  temporary_physical_root="$(cd -P "${TMPDIR:-/tmp}" && pwd)"
  case "$logical_parent" in "$temporary_logical_root"/*) logical_suffix="${logical_parent#"$temporary_logical_root"/}" ;; *) die "AIWA_TEST_DATABASE_URL must resolve under the disposable temporary directory" ;; esac
  case "$physical_database" in "$temporary_physical_root"/*) ;; *) die "AIWA_TEST_DATABASE_URL must resolve under the disposable temporary directory" ;; esac
  physical_suffix="${physical_parent#"$temporary_physical_root"/}"
  [[ "$logical_suffix" == "$physical_suffix" ]] || die "AIWA_TEST_DATABASE_URL must not use a realpath alias"
  [[ ! -e "$candidate_path" && ! -L "$candidate_path" ]] || die "AIWA_TEST_DATABASE_URL must target a fresh disposable database"
  canonical_database="$physical_database"
fi
CANONICAL_DATABASE_URL="file:$canonical_database"
if [[ "${1:-}" == "--check-database-url" ]]; then
  echo "PASS test database URL accepted: $CANONICAL_DATABASE_URL"
  exit 0
fi
cd "$ROOT"
DATABASE_URL="$CANONICAL_DATABASE_URL" node scripts/db-v090-reset.mjs --yes
DATABASE_URL="$CANONICAL_DATABASE_URL" ./node_modules/.bin/prisma generate
DATABASE_URL="$CANONICAL_DATABASE_URL" ./node_modules/.bin/prisma db push --skip-generate --accept-data-loss
DATABASE_URL="$CANONICAL_DATABASE_URL" node --import tsx --test --test-concurrency=1 tests/*.test.ts
