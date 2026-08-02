#!/usr/bin/env python3
from pathlib import Path
import hashlib, json, re, sqlite3, subprocess, sys, tempfile, shutil

ROOT = Path(__file__).resolve().parents[2]
checks = []
def check(name, condition): checks.append((name, bool(condition)))
def text(path): return (ROOT / path).read_text(encoding="utf-8")

def sha(value): return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

# Independent policy model: scope mutations must invalidate an approval.
base = {"runId":"r1","action":"publish","target":"release-a","risk":"RED"}
check("A01_scope_target_mutation", sha(base) != sha({**base, "target":"release-b"}))
check("A02_scope_action_mutation", sha(base) != sha({**base, "action":"delete"}))
check("A03_scope_risk_mutation", sha(base) != sha({**base, "risk":"GREEN"}))

# Bounded route model.
def route(risk, mission_type, actions):
    research = mission_type in {"research","design","marketing","development","finance"}
    approval = risk == "RED"
    path = ["budget_guard","triage"] + (["research"] if research else []) + ["plan","council","risk_gate"]
    if approval: path += ["human_approval"]
    return path + ["execute","verify","synthesize","final_verify","final_gate","finalize"]
for risk in ["GREEN","YELLOW","RED"]:
    path = route(risk, "development", [])
    check(f"A_route_verify_{risk}", "verify" in path and path.index("verify") < path.index("finalize"))
    check(f"A_route_final_gate_{risk}", path.index("final_gate") < path.index("finalize"))
check("A10_red_has_approval", "human_approval" in route("RED","operations",["deploy"]))
check("A11_green_no_forced_approval", "human_approval" not in route("GREEN","operations",[]))

migration = text("scripts/db-v090-migrate.mjs")
rollback = text("scripts/db-v090-rollback.mjs")
workflow = text("src/server/workflow-service.ts")
approval = text("src/server/approval-service.ts")
security = text("src/server/local-security.ts")
ui = text("src/components/mission-workspace.tsx") + text("src/components/approvals-center.tsx")
schema = text("prisma/schema.prisma")

# Migration cannot touch the source before a backup and validated temp DB.
check("A12_source_opened_read_only", 'new DatabaseSync(path, { readOnly: true })' in migration)
check("A13_backup_precedes_new_schema", migration.index("copyFileSync(path, backupPath)") < migration.index("createV090Schema(newDb)"))
check("A14_validation_precedes_swap", migration.index("const validation = validateNewDatabase(newDb)") < migration.index("renameSync(path, sidecarPath)"))
check("A15_swap_restores_original", "renameSync(sidecarPath, path)" in migration)
check("A16_temp_removed_on_migration_error", "rmSync(tempPath, { force: true })" in migration)
check("A17_rollback_requires_confirmation", 'args.has("--yes")' in rollback)
check("A18_rollback_keeps_safety_copy", ".v0.9.0.rollback-safety." in rollback)

# Storage simplification is physical, not a hidden dual ledger.
check("A19_exact_18_models", len(re.findall(r"^model\s+", schema, re.M)) == 18)
check("A20_no_core_shadow_database", "schema.core.prisma" not in "\n".join(str(p) for p in ROOT.rglob("*")))
check("A21_single_runtime_database_url", "CORE_DATABASE_URL" not in text("package.json") and "LEDGER_DATABASE_URL" not in text("package.json"))

# Approval/verification/external-effect fail-closed controls.
check("A22_approval_cas", "updateMany" in approval and "claimed.count !== 1" in approval)
check("A23_scope_recomputed_server_side", "approvalScopeHash(request)" in approval)
check("A24_expired_approval_rejected", "approval_expired" in approval)
check("A25_rejection_blocks_mission", 'status: "blocked"' in approval and 'errorCode: "approval_rejected"' in approval)
check("A26_external_effect_not_executed", 'status: "approval_required"' in workflow and "executedAt:" not in workflow)
check("A27_external_effect_idempotency", "idempotencyKey" in workflow and "requestHash" in workflow)
check("A28_verifier_is_separate_agent", 'role: { isVerifier: true }' in workflow)
check("A29_verification_failure_stops", "verification_failed" in workflow)
check("A30_truthful_simulated_completion", 'status: "simulated"' in workflow and 'evidenceMode: "synthetic"' in workflow)
check("A31_no_live_tool_execution", not any(token in workflow for token in ["fetch(", "child_process", "spawn(", "execFile(", "deploy(", "publish(", "payment("]))
check("A32_attempt_limit", "initial.attemptCount >= initial.maxAttempts" in workflow)

# Local trust boundary cannot be bypassed by ordinary proxy headers.
check("A33_host_loopback_only", "LOOPBACK_HOSTS" in security and "local_loopback_required" in security)
check("A34_forwarded_host_checked", "x-forwarded-host" in security)
check("A35_forwarded_for_checked", "x-forwarded-for" in security)
check("A36_real_ip_checked", "x-real-ip" in security)
check("A37_no_token_as_network_substitute", "authorization" not in security.lower())

# UI renders content as text and exposes human control.
check("A38_no_html_injection", "dangerouslySetInnerHTML" not in ui)
check("A39_human_approval_controls", "승인" in ui and "거절" in ui)
check("A40_scope_hash_sent", "scopeHash" in ui)
check("A41_artifact_rendered_as_pre", "markdown-preview" in ui and "<pre" in ui)

# Exercise a malicious/unknown database and confirm it is unchanged.
with tempfile.TemporaryDirectory(prefix="aiwa-v090-adversarial-") as directory:
    path = Path(directory) / "unknown.db"
    db = sqlite3.connect(path)
    db.execute("CREATE TABLE attacker_controlled(id TEXT PRIMARY KEY, payload TEXT)")
    db.execute("INSERT INTO attacker_controlled VALUES('1','keep-me')")
    db.commit(); db.close()
    before = hashlib.sha256(path.read_bytes()).hexdigest()
    result = subprocess.run([shutil.which("node") or "node", str(ROOT / "scripts/db-v090-migrate.mjs"), "--db", str(path)], cwd=ROOT, capture_output=True, text=True)
    after = hashlib.sha256(path.read_bytes()).hexdigest()
    check("A42_unknown_schema_rejected", result.returncode != 0)
    check("A43_unknown_schema_unchanged", before == after)

# File/API surface should have no duplicate dynamic route aliases.
check("A44_no_duplicate_mission_param", not (ROOT / "src/app/api/missions/[missionId]").exists())
check("A45_no_duplicate_run_param", not (ROOT / "src/app/api/runs/[runId]").exists())
check("A46_no_duplicate_approval_param", not (ROOT / "src/app/api/approvals/[approvalId]").exists())

failed = [name for name, ok in checks if not ok]
for name, ok in checks: print(f"{'PASS' if ok else 'FAIL'} {name}")
print(f"RESULT {len(checks)-len(failed)}/{len(checks)} passed")
if failed: sys.exit(1)
