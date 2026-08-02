#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET=""
FORCE=""

usage(){ echo "Usage: $(basename "$0") /path/to/target [--force]"; }
for arg in "$@"; do
  case "$arg" in
    --force) FORCE="--force" ;;
    -h|--help) usage; exit 0 ;;
    --*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *) [[ -z "$TARGET" ]] || { echo "Only one target path is allowed" >&2; exit 2; }; TARGET="$arg" ;;
  esac
done
[[ -n "$TARGET" ]] || { usage >&2; exit 2; }

"$ROOT/verify-bundle.sh"
"$ROOT/apply.sh" "$TARGET" ${FORCE:+$FORCE}
TARGET="$(cd "$TARGET" && pwd)"
cd "$TARGET"
exec bash scripts/install-local-v090.sh
