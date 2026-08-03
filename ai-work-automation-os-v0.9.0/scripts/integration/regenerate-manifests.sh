#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export LC_ALL=C

write_manifest() {
  local root="$1" target="$2" temporary="${2}.tmp"
  (
    cd "$root"
    find . \
      -type d \( -name node_modules -o -name .next -o -name data -o -name backups -o -name artifacts -o -name .aiwa-backups \) -prune -o \
      -type f \( ! \( -name '.env' -o -name '.env.*' \) -o -name '.env.example' -o -name '.env.local.example' \) ! -name '.npmrc' ! -name '*.tsbuildinfo' ! -path "./${target##*/}" ! -path "./${target##*/}.tmp" -print0 |
      sort -z |
      while IFS= read -r -d '' path; do shasum -a 256 "$path"; done
  ) > "$temporary"
  mv "$temporary" "$target"
}

write_manifest "$PACKAGE_ROOT/source" "$PACKAGE_ROOT/source/MANIFEST.sha256"
write_manifest "$PACKAGE_ROOT" "$PACKAGE_ROOT/MANIFEST.sha256"
printf 'PASS regenerated manifests: %s %s\n' "$PACKAGE_ROOT/source/MANIFEST.sha256" "$PACKAGE_ROOT/MANIFEST.sha256"
