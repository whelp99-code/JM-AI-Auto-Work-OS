#!/usr/bin/env python3
from pathlib import Path
import json, re, sys

ROOT = Path(__file__).resolve().parents[2]
checks = []
def check(name, condition, detail=""):
    checks.append((name, bool(condition), detail))
def text(path):
    return (ROOT / path).read_text(encoding="utf-8")

pkg = json.loads(text("package.json"))
check("package_name", pkg.get("name") == "ai-work-automation-os")
check("package_version", pkg.get("version") == "0.9.0")
check("local_dev_bind", "127.0.0.1" in pkg["scripts"].get("dev", ""))
check("local_start_bind", "127.0.0.1" in pkg["scripts"].get("start", ""))
check("no_active_supabase_dependency", not any("supabase" in name.lower() for name in pkg.get("dependencies", {})))
for script in ["db:rebuild", "db:rebuild:dry-run", "db:rollback:v0.8", "db:doctor", "db:backup", "local:install", "local:verify", "verify:v0.9.0"]:
    check(f"script_{script}", script in pkg.get("scripts", {}))

schema = text("prisma/schema.prisma")
models = re.findall(r"^model\s+(\w+)\s*\{", schema, re.M)
maps = re.findall(r'^\s*@@map\("([^\"]+)"\)', schema, re.M)
expected_models = ["Workspace","OrgUnit","Role","Agent","Mission","MissionRun","WorkItem","WorkflowStep","WorkflowTransition","Review","Approval","CouncilSession","CouncilMessage","DecisionRecord","Artifact","ExternalEffect","EventLog","FileAsset"]
expected_maps = ["workspace","org_unit","role","agent","mission","mission_run","work_item","workflow_step","workflow_transition","review","approval","council_session","council_message","decision_record","artifact","external_effect","event_log","file_asset"]
check("prisma_exact_18_models", models == expected_models, str(models))
check("prisma_exact_18_maps", maps == expected_maps, str(maps))
check("sqlite_primary_schema", 'provider = "sqlite"' in schema)
check("schema_version_090", '@default("0.9.0")' in schema)
check("legacy_schema_preserved", (ROOT / "prisma/schema.v0.8.0.prisma").exists())
check("future_postgres_isolated", (ROOT / "prisma/schema.supabase.prisma").exists() and 'provider = "postgresql"' in text("prisma/schema.supabase.prisma"))
check("no_dual_core_schema", not (ROOT / "prisma/schema.core.prisma").exists())

sql = text("scripts/db-v090-schema.mjs")
check("core_tables_constant", "export const CORE_TABLES" in sql)
check("sql_exact_18_create_tables", sql.count("CREATE TABLE IF NOT EXISTS ") == 18)
check("foreign_keys_enabled", "PRAGMA foreign_keys = ON" in sql)
for table in expected_maps:
    check(f"sql_table_{table}", f"CREATE TABLE IF NOT EXISTS {table} " in sql)
for index in ["idx_mission_status","idx_run_status","idx_org_unit_scope","idx_work_item_run","idx_step_run","idx_review_run","idx_approval_run","idx_event_run"]:
    check(f"index_{index}", index in sql)

migration = text("scripts/db-v090-migrate.mjs")
check("migration_detects_080", 'generation !== "0.8.0"' in migration)
check("migration_rejects_unknown", "Unsupported source schema" in migration)
check("migration_dry_run", 'args.has("--dry-run")' in migration and "if (dryRun)" in migration)
check("migration_backup_first", migration.index("copyFileSync(path, backupPath)") < migration.index("createV090Schema(newDb)"))
check("migration_source_read_only", 'new DatabaseSync(path, { readOnly: true })' in migration)
check("migration_temp_db", 'const tempPath = `${path}.v0.9.0.tmp`' in migration)
check("migration_transaction", 'newDb.exec("BEGIN IMMEDIATE")' in migration and 'newDb.exec("COMMIT")' in migration and 'newDb.exec("ROLLBACK")' in migration)
check("migration_validates_fk", "PRAGMA foreign_key_check" in migration)
check("migration_validates_before_swap", migration.index("const validation = validateNewDatabase(newDb)") < migration.index("renameSync(path, sidecarPath)"))
check("migration_atomic_swap", "renameSync(path, sidecarPath)" in migration and "renameSync(tempPath, path)" in migration)
check("migration_swap_rollback", "renameSync(sidecarPath, path)" in migration)
check("migration_two_pass_team", "pendingTeamParents" in migration)
check("migration_two_pass_manager", "pendingManagers" in migration)
check("migration_report", "reportPath" in migration and "writeFileSync" in migration)
rollback = text("scripts/db-v090-rollback.mjs")
check("rollback_confirmation", 'args.has("--yes")' in rollback)
check("rollback_safety_copy", ".v0.9.0.rollback-safety." in rollback)

required_services = ["mission-service.ts","organization-service.ts","workflow-service.ts","approval-service.ts","council-service.ts","workspace-service.ts","database-service.ts","event-service.ts","local-security.ts"]
for service in required_services:
    check(f"service_{service}", (ROOT / "src/server" / service).exists())
for obsolete in ["runtime-service.ts","read-model.ts","local-auth.ts","database-health.ts","api.ts"]:
    check(f"obsolete_removed_{obsolete}", not (ROOT / "src/server" / obsolete).exists())

workflow = text("src/server/workflow-service.ts")
approval = text("src/server/approval-service.ts")
organization = text("src/server/organization-service.ts")
council = text("src/server/council-service.ts")
workspace = text("src/server/workspace-service.ts")
security = text("src/server/local-security.ts")
product = text("src/lib/product.ts")
contracts = text("src/lib/contracts.ts")

def pos(source, token):
    return source.find(token)

check("workflow_org_provisioning", "provisionMissionOrganization" in workflow)
check("workflow_policy_driven", "workflowPolicy" in workflow and "workflowPath" in workflow)
check("workflow_human_approval", 'status: "waiting_approval"' in workflow and "approvalScopeHash" in workflow)
check("workflow_independent_review", 'reviewType: "independent"' in workflow and "isVerifier: true" in workflow)
check("workflow_final_gate_after_review", pos(workflow, 'reviewType: "independent"') < pos(workflow, '"final_gate"'))
check("workflow_truthful_simulation", 'status: "simulated"' in workflow and 'evidenceMode: "synthetic"' in workflow)
check("workflow_external_effect_ledger", "externalEffect.create" in workflow and 'status: "approval_required"' in workflow)
check("workflow_no_external_execution", not any(token in workflow for token in ["fetch(", "spawn(", "execFile(", "child_process", "provider.publish", "provider.deploy"]))
check("workflow_retry_bound", "initial.attemptCount >= initial.maxAttempts" in workflow)
check("run_idempotency", "missionId_idempotencyKey" in text("src/server/mission-service.ts"))
check("approval_cas", "updateMany" in approval and 'status: "pending"' in approval and "claimed.count !== 1" in approval)
check("approval_scope_binding", "approvalScopeHash(request)" in approval and "approval_scope_mismatch" in approval)
check("approval_rejection_blocks", 'errorCode: "approval_rejected"' in approval)
check("approval_resume_explicit", "executeMissionRun(approval.missionRunId)" in approval)
check("organization_has_manager", 'key: "executive-manager"' in organization)
check("organization_has_verifier", "isVerifier" in organization and "role: { isVerifier: true }" in workflow)
check("council_decision_support", 'sourceType: "council"' in council and "execution_strategy" in council)
check("council_no_effect_execution", "externalEffect" not in council and "fetch(" not in council)
for area in ["workItems","steps","transitions","reviews","approvals","councils","decisions","artifacts","effects","events"]:
    check(f"workspace_{area}", area in workspace)
check("local_loopback_host", "LOOPBACK_HOSTS" in security and "127." in security)
check("local_forwarded_ip_guard", "x-forwarded-for" in security and "x-real-ip" in security)
check("product_definition_work_automation", "업무 자동화" in product and 'name: "AI Work Automation OS"' in product)
check("proofgraph_separated", "별도의 소프트웨어 개발 에이전트" in product)
check("budget_bound", "10_000" in contracts)
check("action_bound", "slice(0, 30)" in contracts)
check("risk_fail_closed", "payment|delete|deploy|publish" in contracts)

canonical_routes = [
    "src/app/api/missions/route.ts", "src/app/api/missions/[id]/runs/route.ts",
    "src/app/api/runs/[id]/workspace/route.ts", "src/app/api/runs/[id]/execute/route.ts",
    "src/app/api/runs/[id]/council/route.ts", "src/app/api/approvals/route.ts",
    "src/app/api/approvals/[id]/route.ts", "src/app/api/system/database/route.ts"
]
for route in canonical_routes:
    check(f"route_{route}", (ROOT / route).exists())
check("no_duplicate_dynamic_mission_routes", not (ROOT / "src/app/api/missions/[missionId]").exists())
check("no_duplicate_dynamic_run_routes", not (ROOT / "src/app/api/runs/[runId]").exists())
check("no_duplicate_dynamic_approval_routes", not (ROOT / "src/app/api/approvals/[approvalId]").exists())

ui_files = ["command-center.tsx","mission-workspace.tsx","approvals-center.tsx","council-center.tsx","database-settings.tsx"]
for ui in ui_files:
    check(f"ui_{ui}", (ROOT / "src/components" / ui).exists())
all_ui = "\n".join((ROOT / "src/components" / ui).read_text(encoding="utf-8") for ui in ui_files)
check("ui_version_visible", "v0.9.0" in all_ui)
check("ui_db_18_visible", "canonical tables" in all_ui or "물리 테이블" in all_ui)
check("ui_no_dangerous_html", "dangerouslySetInnerHTML" not in all_ui)
check("ui_integrated_workflow", all(term in text("src/components/mission-workspace.tsx") for term in ["AI 조직","Workflow","승인","AI Council","검증·증거","산출물","감사 기록"]))

all_source = "\n".join(path.read_text(encoding="utf-8") for path in (ROOT / "src").rglob("*.ts*"))
check("no_active_supabase_import", "@supabase/" not in all_source and "supabase-js" not in all_source)
check("no_proofgraph_runtime_product", "ProofGraph Runtime" not in all_source)
check("no_phase_user_facing", "Phase 9" not in all_source and "phase9" not in all_source.lower())

failed = [item for item in checks if not item[1]]
for name, ok, detail in checks:
    print(f"{'PASS' if ok else 'FAIL'} {name}{(': ' + detail) if detail and not ok else ''}")
print(f"RESULT {len(checks)-len(failed)}/{len(checks)} passed")
if failed:
    sys.exit(1)
