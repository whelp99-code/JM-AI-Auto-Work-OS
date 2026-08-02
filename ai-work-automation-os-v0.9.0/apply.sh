#!/usr/bin/env bash
set -euo pipefail

VERSION="0.9.0"
PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$PACKAGE_ROOT/source"
TARGET=""
FORCE=0

usage() {
  cat <<USAGE
Usage: $(basename "$0") /path/to/target [--force]

Applies the complete AI Work Automation OS v0.9.0 source tree.
Preserved: .git, .env, .env.local, data/, backups/, artifacts/.
The database is not modified by this script.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "Unknown option: $arg" >&2; usage >&2; exit 2 ;;
    *) [[ -z "$TARGET" ]] || { echo "Only one target path is allowed" >&2; exit 2; }; TARGET="$arg" ;;
  esac
done
[[ -n "$TARGET" ]] || { usage >&2; exit 2; }
[[ -d "$SOURCE" && -f "$SOURCE/package.json" && -f "$SOURCE/MANIFEST.sha256" ]] || { echo "Invalid v0.9.0 package payload" >&2; exit 3; }

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  else echo "sha256sum or shasum is required" >&2; return 1
  fi
}
verify_manifest() {
  local dir="$1" manifest="$2"
  if command -v sha256sum >/dev/null 2>&1; then (cd "$dir" && sha256sum -c "$manifest" >/dev/null)
  else (cd "$dir" && shasum -a 256 -c "$manifest" >/dev/null)
  fi
}
verify_manifest "$SOURCE" MANIFEST.sha256 || { echo "Source manifest verification failed" >&2; exit 4; }

mkdir -p "$TARGET"
TARGET="$(cd "$TARGET" && pwd)"
[[ "$TARGET" != "/" && "$TARGET" != "$HOME" ]] || { echo "Refusing unsafe target: $TARGET" >&2; exit 5; }

existing_version=""
if [[ -f "$TARGET/package.json" ]] && command -v node >/dev/null 2>&1; then
  existing_version="$(node -e 'try{console.log(require(process.argv[1]).version||"")}catch{}' "$TARGET/package.json" 2>/dev/null || true)"
fi
if [[ -n "$existing_version" && "$existing_version" != "0.8.0" && "$existing_version" != "0.9.0" && "$FORCE" -ne 1 ]]; then
  echo "Existing source version is '$existing_version'. v0.9.0 direct upgrade supports v0.8.0. Use --force only after an explicit source review." >&2
  exit 6
fi

already=1
while IFS= read -r line; do
  expected="${line%% *}"
  rel="${line#*  }"; rel="${rel#./}"
  [[ -f "$TARGET/$rel" && "$(hash_file "$TARGET/$rel")" == "$expected" ]] || { already=0; break; }
done < "$SOURCE/MANIFEST.sha256"
if [[ "$already" -eq 1 && -f "$TARGET/.aiwa-version" && "$(tr -d '[:space:]' < "$TARGET/.aiwa-version")" == "$VERSION" ]]; then
  echo "AI Work Automation OS v$VERSION is already applied: $TARGET"
  exit 0
fi

if [[ -d "$TARGET/.git" && "$FORCE" -ne 1 ]]; then
  [[ -z "$(git -C "$TARGET" status --porcelain --untracked-files=normal 2>/dev/null || true)" ]] || {
    echo "Git worktree is not clean. Commit/stash changes or use --force." >&2
    exit 7
  }
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_dir="$TARGET/.aiwa-backups"
mkdir -p "$backup_dir"
backup_file="$backup_dir/source-before-v${VERSION}-${stamp}.tar.gz"

managed=(
  src prisma scripts tests verification docs .github public
  package.json package-lock.json tsconfig.json tsconfig.verification.json
  next.config.ts next-env.d.ts postcss.config.js postcss.config.mjs
  tailwind.config.js tailwind.config.ts eslint.config.js eslint.config.mjs
  .eslintrc .eslintrc.json .nvmrc .gitignore .env.example .env.local.example
  README.md CHANGELOG.md VERSION MANIFEST.sha256 verify-offline.sh
)
existing=()
for path in "${managed[@]}"; do
  [[ -e "$TARGET/$path" || -L "$TARGET/$path" ]] && existing+=("$path")
done
if (( ${#existing[@]} > 0 )); then
  tar -czf "$backup_file" -C "$TARGET" "${existing[@]}"
else
  backup_file="$backup_dir/source-before-v${VERSION}-${stamp}.txt"
  printf 'New or empty target\n' > "$backup_file"
fi

for path in "${managed[@]}"; do rm -rf "$TARGET/$path"; done
tar -cf - -C "$SOURCE" . | tar -xf - -C "$TARGET"
printf '%s\n' "$VERSION" > "$TARGET/.aiwa-version"

failed=0
while IFS= read -r line; do
  expected="${line%% *}"
  rel="${line#*  }"; rel="${rel#./}"
  if [[ ! -f "$TARGET/$rel" ]]; then
    echo "Missing copied file: $rel" >&2; failed=1
  elif [[ "$(hash_file "$TARGET/$rel")" != "$expected" ]]; then
    echo "Hash mismatch after copy: $rel" >&2; failed=1
  fi
done < "$SOURCE/MANIFEST.sha256"
[[ "$failed" -eq 0 ]] || exit 8

if [[ -n "$existing_version" ]]; then
  previous_json="\"$existing_version\""
else
  previous_json="null"
fi
cat > "$TARGET/.aiwa-install-report.json" <<REPORT
{
  "product": "AI Work Automation OS",
  "version": "$VERSION",
  "action": "source-applied",
  "previousVersion": $previous_json,
  "appliedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "sourceBackup": "$backup_file",
  "databaseModified": false
}
REPORT

echo "Applied AI Work Automation OS v$VERSION to: $TARGET"
echo "Source backup: $backup_file"
echo "Preserved: .git, .env, .env.local, data, backups, artifacts"
echo "Database unchanged. Run install-local.sh or the target DB migration commands next."
