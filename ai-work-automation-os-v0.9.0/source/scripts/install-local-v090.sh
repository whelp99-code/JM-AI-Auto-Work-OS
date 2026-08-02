#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

major="$(node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || echo 0)"
[[ "$major" -ge 22 ]] || { echo "Node.js 22+ is required (current major: $major)" >&2; exit 10; }

mkdir -p data backups artifacts
[[ -f .env ]] || cp .env.example .env
[[ -f .env.local ]] || cp .env.local.example .env.local

printf '\n[1/10] Database rebuild dry-run (database is not modified)\n'
node scripts/db-v090-migrate.mjs --dry-run
printf '\n[2/10] Dependencies\n'
npm install --no-audit --no-fund
printf '\n[3/10] Atomic database rebuild or fresh creation\n'
node scripts/db-v090-migrate.mjs
printf '\n[4/10] Prisma client\n'
npm exec prisma generate
printf '\n[5/10] Local workspace seed\n'
node scripts/db-v090-seed.mjs
printf '\n[6/10] Dependency-free verification\n'
bash ./verify-offline.sh
printf '\n[7/10] Database doctor\n'
node scripts/db-v090-doctor.mjs
printf '\n[8/10] Type check\n'
npm run check
printf '\n[9/10] Full tests\n'
npm test
printf '\n[10/10] Production build\n'
npm run build

cat <<MSG

AI Work Automation OS v0.9.0 installed and verified.
Run:  npm run dev
Open: http://127.0.0.1:3000
DB:   data/ai-work-automation.db
MSG
