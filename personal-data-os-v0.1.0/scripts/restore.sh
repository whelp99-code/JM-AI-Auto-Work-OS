#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${DATABASE_URL:?DATABASE_URL is required}"
dump="${1:?backup dump path required}"
manifest="$dump.sha256"
[ -f "$manifest" ] || { echo "missing checksum manifest" >&2; exit 2; }
sha256sum -c "$manifest"
pg_restore --clean --if-exists --no-owner --no-acl --dbname "$DATABASE_URL" "$dump"
