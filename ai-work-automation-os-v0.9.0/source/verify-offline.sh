#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
node --test tests/v090-schema.test.mjs tests/v090-migration.test.mjs
node verification/scripts/v090_pure_tests.mjs
python3 verification/scripts/v090_schema_parity.py
python3 verification/scripts/v090_static_verification.py
python3 verification/scripts/v090_adversarial_verification.py
node verification/scripts/v090_ts_syntax.mjs
if [[ -x "$ROOT/node_modules/.bin/tsc" ]]; then
  "$ROOT/node_modules/.bin/tsc" -p tsconfig.verification.json
elif command -v tsc >/dev/null 2>&1; then
  tsc -p tsconfig.verification.json
elif [[ -x /opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/bin/tsc ]]; then
  /opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/bin/tsc -p tsconfig.verification.json
else
  echo "SKIP stub semantic TypeScript check: tsc is unavailable" >&2
fi
bash -n scripts/install-local-v090.sh
printf 'PASS v0.9.0 offline verification\n'
