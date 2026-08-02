#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-}"
[[ -n "$TARGET" && -d "$TARGET" ]] || { echo "Usage: $0 /path/to/v0.8.0-repository [--force]" >&2; exit 2; }
version=""
if [[ -f "$TARGET/package.json" ]]; then
  version="$(node -e 'try{console.log(require(process.argv[1]).version||"")}catch{}' "$TARGET/package.json" 2>/dev/null || true)"
fi
[[ "$version" == "0.8.0" ]] || { echo "Expected v0.8.0 target, found '${version:-unknown}'" >&2; exit 3; }
exec "$ROOT/apply.sh" "$@"
