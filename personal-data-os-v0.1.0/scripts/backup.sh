#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${DATABASE_URL:?DATABASE_URL is required}"
out_dir="${1:-backups}"
mkdir -p "$out_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$out_dir/jm-data-os-$stamp.dump"
manifest="$dump.sha256"
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "$dump"
sha256sum "$dump" > "$manifest"
echo "$dump"
