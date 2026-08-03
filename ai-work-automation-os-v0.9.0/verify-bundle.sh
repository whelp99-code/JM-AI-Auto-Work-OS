#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

check_manifest() {
  local dir="$1" manifest="$2"
  if command -v sha256sum >/dev/null 2>&1; then (cd "$dir" && sha256sum -c "$manifest")
  elif command -v shasum >/dev/null 2>&1; then (cd "$dir" && shasum -a 256 -c "$manifest")
  else echo "sha256sum or shasum is required" >&2; exit 2
  fi
}

required=(
  README-FIRST.md PROJECT-DEFINITION.md V0.9.0-DEVELOPMENT-PLAN.md
  DB-REBUILD-DESIGN-v0.9.0.md MIGRATION-v0.8.0-to-v0.9.0.md
  LOCAL-INSTALLATION.md HERMES-v0.9.0-INSTALLATION-DIRECTIVE.md
  IMPLEMENTATION-REPORT.md INDEPENDENT-VERIFICATION.md
  ADVERSARIAL-VERIFICATION.md VERIFICATION-REPORT.md KNOWN-LIMITATIONS.md
  RELEASE-NOTES-v0.9.0.md SECURITY-MODEL.md UI-UX-WORKFLOW-SPEC.md
  PACKAGE-METADATA.json VERSION apply.sh apply-on-v0.8.0.sh install-local.sh
  verify-target.sh source/MANIFEST.sha256 source/package.json source/package-lock.json
  patches/v0.8.0-to-v0.9.0.patch
)
for file in "${required[@]}"; do
  [[ -f "$ROOT/$file" ]] || { echo "Missing package file: $file" >&2; exit 3; }
done

check_manifest "$ROOT/source" MANIFEST.sha256 >/dev/null
for file in "$ROOT"/*.sh "$ROOT/source"/*.sh "$ROOT/source/scripts"/*.sh; do
  [[ -e "$file" ]] || continue
  bash -n "$file"
done

node - "$ROOT" <<'NODE'
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const meta = JSON.parse(fs.readFileSync(path.join(root, 'PACKAGE-METADATA.json'), 'utf8'));
if (meta.product !== 'AI Work Automation OS' || meta.version !== '0.9.0') throw new Error('package identity mismatch');
if (meta.physicalTableCount !== 18 || meta.runtimeLedgerPreserved !== false || meta.projectionDatabase !== false) throw new Error('database architecture metadata mismatch');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'source/package.json'), 'utf8'));
if (pkg.name !== 'ai-work-automation-os' || pkg.version !== '0.9.0') throw new Error('source package mismatch');
const schema = fs.readFileSync(path.join(root, 'source/prisma/schema.prisma'), 'utf8');
const models = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(m => m[1]);
if (models.length !== 18) throw new Error(`expected 18 Prisma models, got ${models.length}`);
NODE

bash "$ROOT/source/verify-offline.sh" >/dev/null
for manifest in "$ROOT/source/MANIFEST.sha256" "$ROOT/MANIFEST.sha256"; do
  ! grep -q '/node_modules/' "$manifest" || { echo "node_modules must not be packaged: $manifest" >&2; exit 4; }
done

if [[ -f "$ROOT/MANIFEST.sha256" ]]; then
  check_manifest "$ROOT" MANIFEST.sha256 >/dev/null
fi

echo "PACKAGE VERIFICATION PASS: AI Work Automation OS v0.9.0 (single SQLite / 18 tables)"
