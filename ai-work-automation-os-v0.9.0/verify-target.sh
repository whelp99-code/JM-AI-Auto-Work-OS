#!/usr/bin/env bash
set -euo pipefail
TARGET="${1:-}"
[[ -n "$TARGET" && -d "$TARGET" ]] || { echo "Usage: $0 /path/to/v0.9.0-target" >&2; exit 2; }
cd "$(cd "$TARGET" && pwd)"
[[ -f VERSION && "$(tr -d '[:space:]' < VERSION)" == "0.9.0" ]] || { echo "Target VERSION is not 0.9.0" >&2; exit 3; }
node -e 'const p=require("./package.json");if(p.name!=="ai-work-automation-os"||p.version!=="0.9.0")throw new Error(`unexpected package ${p.name}@${p.version}`)'

bash ./verify-offline.sh
node scripts/db-v090-migrate.mjs --dry-run
npm install --no-audit --no-fund
node scripts/db-v090-migrate.mjs
npm exec prisma generate
node scripts/db-v090-seed.mjs
node scripts/db-v090-doctor.mjs
npm run check
npm test
npm run build

echo "TARGET VERIFICATION PASS: AI Work Automation OS v0.9.0"
