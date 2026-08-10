#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export LC_ALL=C

fixture_root="$(mktemp -d)"
fixture_package="$fixture_root/package"
trap 'rm -rf "$fixture_root"' EXIT
rsync -a \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='data/' \
  --exclude='backups/' \
  --exclude='artifacts/' \
  --exclude='.aiwa-backups/' \
  "$PACKAGE_ROOT/" "$fixture_package/"

SOURCE_MANIFEST="$fixture_package/source/MANIFEST.sha256"
PACKAGE_MANIFEST="$fixture_package/MANIFEST.sha256"
secret_names=(
  .env
  .env.local
  .env.development
  .env.production
  .env.test
  .env.staging
  .env.preview
  .env.development.local
  .env.production.local
  .env.test.local
  .npmrc
)
safe_names=(.env.example .env.local.example)
manifest_has_path() {
  awk -v target="$2" 'substr($0, 67) == target { found = 1 } END { exit(found ? 0 : 1) }' "$1"
}

for directory in "$fixture_package" "$fixture_package/source"; do
  for name in "${secret_names[@]}"; do printf 'secret\n' > "$directory/$name"; done
  for name in "${safe_names[@]}"; do printf 'safe template\n' > "$directory/$name"; done
done
mkdir -p "$fixture_package/source/.aiwa-backups" "$fixture_package/docs/nested/node_modules"
printf 'secret\n' > "$fixture_package/source/.aiwa-backups/secret.txt"
printf 'cache\n' > "$fixture_package/docs/nested/node_modules/cache.bin"

bash "$fixture_package/scripts/integration/regenerate-manifests.sh"
first_source="$(shasum -a 256 "$SOURCE_MANIFEST" | awk '{print $1}')"
first_package="$(shasum -a 256 "$PACKAGE_MANIFEST" | awk '{print $1}')"
bash "$fixture_package/scripts/integration/regenerate-manifests.sh"
test "$first_source" = "$(shasum -a 256 "$SOURCE_MANIFEST" | awk '{print $1}')"
test "$first_package" = "$(shasum -a 256 "$PACKAGE_MANIFEST" | awk '{print $1}')"

for manifest in "$SOURCE_MANIFEST" "$PACKAGE_MANIFEST"; do
  paths="$(cut -c 67- "$manifest")"
  test "$paths" = "$(printf '%s\n' "$paths" | sort)"
  ! grep -q '  ./MANIFEST.sha256$' "$manifest"
  ! grep -Eq '(^|/)(node_modules|\.next|data|backups|artifacts|\.aiwa-backups)/|\.tsbuildinfo$' "$manifest"
done

for name in "${secret_names[@]}"; do
  ! manifest_has_path "$SOURCE_MANIFEST" "./$name"
  ! manifest_has_path "$PACKAGE_MANIFEST" "./$name"
  ! manifest_has_path "$PACKAGE_MANIFEST" "./source/$name"
done
for name in "${safe_names[@]}"; do
  manifest_has_path "$SOURCE_MANIFEST" "./$name"
  manifest_has_path "$PACKAGE_MANIFEST" "./$name"
  manifest_has_path "$PACKAGE_MANIFEST" "./source/$name"
done

grep -q '  ./source/MANIFEST.sha256$' "$PACKAGE_MANIFEST"
grep -q '  ./package-lock.json$' "$SOURCE_MANIFEST"
test "$(grep -c '  ./next-env.d.ts$' "$SOURCE_MANIFEST")" -eq 1
! grep -Eq 'source/\.aiwa-backups/secret\.txt$|docs/nested/node_modules/cache\.bin$' "$PACKAGE_MANIFEST"
! find "$fixture_package" -name 'MANIFEST.sha256.tmp' -print -quit | grep -q .
printf 'PASS manifest generator: sorted, stable, self-excluding, and payload-safe\n'
