#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
TSC_BIN="${AIWA_TSC_BIN:-$ROOT/node_modules/.bin/tsc}"
if [[ ! -x "$TSC_BIN" ]]; then
  echo "TypeScript compiler unavailable: $TSC_BIN" >&2
  exit 1
fi
if [[ "${1:-}" == "--check-toolchain" ]]; then
  echo "PASS TypeScript compiler available: $TSC_BIN"
  exit 0
fi
node --test tests/v090-schema.test.mjs tests/v090-migration.test.mjs
node verification/scripts/v090_pure_tests.mjs
python3 verification/scripts/v090_schema_parity.py
python3 verification/scripts/v090_static_verification.py
python3 verification/scripts/v090_adversarial_verification.py
node verification/scripts/v090_ts_syntax.mjs
"$TSC_BIN" -p tsconfig.verification.json
bash -n scripts/install-local-v090.sh
printf 'PASS v0.9.0 offline verification\n'
