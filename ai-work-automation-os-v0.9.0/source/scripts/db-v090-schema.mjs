export const SCHEMA_VERSION = "0.9.0";

export const CORE_TABLES = Object.freeze([
  "workspace",
  "org_unit",
  "role",
  "agent",
  "mission",
  "mission_run",
  "work_item",
  "workflow_step",
  "workflow_transition",
  "review",
  "approval",
  "council_session",
  "council_message",
  "decision_record",
  "artifact",
  "external_effect",
  "event_log",
  "file_asset"
]);

export const LEGACY_V080_TABLES = Object.freeze([
  "CouncilSession", "CouncilRound", "ParticipantResponse", "Consensus", "Artifact",
  "AuditEvent", "ImportError", "Organization", "OrganizationMembership", "Team",
  "AgentRole", "CapabilityAsset", "RoleCapability", "Mission", "MissionRun", "ExternalEffect",
  "WorkItem", "Dispatch", "Evaluation", "DecisionRecord", "Deliverable", "MissionEvent",
  "GraphDefinition", "GraphRun", "GraphNodeRun", "GraphCheckpoint", "GraphEvent",
  "FailurePacket", "GraphBudgetEntry", "GraphRoleInvocation", "GraphShadowAssessment",
  "MissionOrganization", "OrganizationPlanRecord", "MissionDepartment", "MissionTeam",
  "RoleDefinition", "AgentInstance", "StaffingRequest", "TeamFormationRequest",
  "OrganizationDelegation", "OrganizationRuntimeEvent", "TeamGraphBinding",
  "OrganizationAssignment", "DelegationPolicy"
]);

export const V090_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  schema_version TEXT NOT NULL DEFAULT '0.9.0',
  mode TEXT NOT NULL DEFAULT 'local',
  owner_principal_id TEXT NOT NULL DEFAULT 'local:owner',
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mission (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  mission_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'draft',
  priority TEXT NOT NULL DEFAULT 'normal',
  risk_level TEXT NOT NULL DEFAULT 'GREEN',
  approval_mode TEXT NOT NULL DEFAULT 'delegated',
  budget_micros INTEGER NOT NULL DEFAULT 1000000,
  spent_micros INTEGER NOT NULL DEFAULT 0,
  success_json TEXT NOT NULL DEFAULT '[]',
  constraints_json TEXT NOT NULL DEFAULT '[]',
  input_json TEXT NOT NULL DEFAULT '{}',
  current_stage TEXT NOT NULL DEFAULT 'intake',
  deadline TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mission_run (
  id TEXT PRIMARY KEY NOT NULL,
  mission_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  requested_by TEXT NOT NULL DEFAULT 'local:owner',
  status TEXT NOT NULL DEFAULT 'queued',
  runtime_mode TEXT NOT NULL DEFAULT 'inline',
  current_step_key TEXT,
  state_json TEXT NOT NULL DEFAULT '{}',
  budget_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  error_code TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  lease_owner TEXT,
  lease_epoch INTEGER NOT NULL DEFAULT 0,
  lease_expires_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE,
  UNIQUE (mission_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS org_unit (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  mission_run_id TEXT,
  parent_id TEXT,
  unit_type TEXT NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  budget_micros INTEGER NOT NULL DEFAULT 0,
  spent_micros INTEGER NOT NULL DEFAULT 0,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES org_unit(id) ON DELETE SET NULL,
  UNIQUE (workspace_id, mission_run_id, key)
);

CREATE TABLE IF NOT EXISTS role (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  org_unit_id TEXT,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  responsibilities_json TEXT NOT NULL DEFAULT '[]',
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  permissions_json TEXT NOT NULL DEFAULT '[]',
  tool_policy_json TEXT NOT NULL DEFAULT '{}',
  model_class TEXT NOT NULL DEFAULT 'balanced',
  is_lead INTEGER NOT NULL DEFAULT 0,
  is_verifier INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (org_unit_id) REFERENCES org_unit(id) ON DELETE SET NULL,
  UNIQUE (workspace_id, org_unit_id, key)
);

CREATE TABLE IF NOT EXISTS agent (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  mission_run_id TEXT,
  org_unit_id TEXT,
  role_id TEXT NOT NULL,
  manager_agent_id TEXT,
  name TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  capabilities_json TEXT NOT NULL DEFAULT '[]',
  permissions_json TEXT NOT NULL DEFAULT '[]',
  context_json TEXT NOT NULL DEFAULT '{}',
  budget_micros INTEGER NOT NULL DEFAULT 0,
  spent_micros INTEGER NOT NULL DEFAULT 0,
  temporary INTEGER NOT NULL DEFAULT 1,
  activated_at TEXT,
  retired_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE CASCADE,
  FOREIGN KEY (org_unit_id) REFERENCES org_unit(id) ON DELETE SET NULL,
  FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE RESTRICT,
  FOREIGN KEY (manager_agent_id) REFERENCES agent(id) ON DELETE SET NULL,
  UNIQUE (mission_run_id, role_id, name)
);

CREATE TABLE IF NOT EXISTS work_item (
  id TEXT PRIMARY KEY NOT NULL,
  mission_id TEXT NOT NULL,
  mission_run_id TEXT NOT NULL,
  parent_id TEXT,
  org_unit_id TEXT,
  agent_id TEXT,
  key TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  work_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending',
  risk_level TEXT NOT NULL DEFAULT 'GREEN',
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  criteria_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  cost_micros INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 2,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES work_item(id) ON DELETE SET NULL,
  FOREIGN KEY (org_unit_id) REFERENCES org_unit(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE SET NULL,
  UNIQUE (mission_run_id, key)
);

CREATE TABLE IF NOT EXISTS workflow_step (
  id TEXT PRIMARY KEY NOT NULL,
  mission_run_id TEXT NOT NULL,
  work_item_id TEXT,
  org_unit_id TEXT,
  agent_id TEXT,
  key TEXT NOT NULL,
  instance_key TEXT NOT NULL DEFAULT 'main',
  step_type TEXT NOT NULL,
  role_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 2,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT,
  usage_json TEXT NOT NULL DEFAULT '{}',
  failure_json TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE CASCADE,
  FOREIGN KEY (work_item_id) REFERENCES work_item(id) ON DELETE SET NULL,
  FOREIGN KEY (org_unit_id) REFERENCES org_unit(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE SET NULL,
  UNIQUE (mission_run_id, key, instance_key, attempt)
);

CREATE TABLE IF NOT EXISTS workflow_transition (
  id TEXT PRIMARY KEY NOT NULL,
  mission_run_id TEXT NOT NULL,
  from_step_id TEXT,
  to_step_id TEXT,
  sequence INTEGER NOT NULL,
  condition_type TEXT NOT NULL DEFAULT 'always',
  condition_json TEXT NOT NULL DEFAULT '{}',
  result TEXT NOT NULL DEFAULT 'selected',
  selected INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE CASCADE,
  FOREIGN KEY (from_step_id) REFERENCES workflow_step(id) ON DELETE SET NULL,
  FOREIGN KEY (to_step_id) REFERENCES workflow_step(id) ON DELETE SET NULL,
  UNIQUE (mission_run_id, sequence)
);

CREATE TABLE IF NOT EXISTS review (
  id TEXT PRIMARY KEY NOT NULL,
  mission_id TEXT NOT NULL,
  mission_run_id TEXT NOT NULL,
  work_item_id TEXT,
  workflow_step_id TEXT,
  reviewer_agent_id TEXT,
  review_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  verdict TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  score REAL NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  criteria_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  failure_json TEXT NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE CASCADE,
  FOREIGN KEY (work_item_id) REFERENCES work_item(id) ON DELETE SET NULL,
  FOREIGN KEY (workflow_step_id) REFERENCES workflow_step(id) ON DELETE SET NULL,
  FOREIGN KEY (reviewer_agent_id) REFERENCES agent(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS approval (
  id TEXT PRIMARY KEY NOT NULL,
  mission_id TEXT NOT NULL,
  mission_run_id TEXT NOT NULL,
  work_item_id TEXT,
  org_unit_id TEXT,
  agent_id TEXT,
  approval_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  risk_level TEXT NOT NULL DEFAULT 'YELLOW',
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  decided_by TEXT,
  scope_hash TEXT NOT NULL,
  request_json TEXT NOT NULL DEFAULT '{}',
  decision_json TEXT,
  expires_at TEXT,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE CASCADE,
  FOREIGN KEY (work_item_id) REFERENCES work_item(id) ON DELETE SET NULL,
  FOREIGN KEY (org_unit_id) REFERENCES org_unit(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE SET NULL,
  UNIQUE (mission_run_id, approval_type, target_type, target_id, scope_hash)
);

CREATE TABLE IF NOT EXISTS council_session (
  id TEXT PRIMARY KEY NOT NULL,
  mission_id TEXT NOT NULL,
  mission_run_id TEXT,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  current_round INTEGER NOT NULL DEFAULT 0,
  budget_micros INTEGER NOT NULL DEFAULT 0,
  cost_micros INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS council_message (
  id TEXT PRIMARY KEY NOT NULL,
  council_session_id TEXT NOT NULL,
  role_id TEXT,
  agent_id TEXT,
  round INTEGER NOT NULL DEFAULT 1,
  speaker_type TEXT NOT NULL,
  message_type TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_micros INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (council_session_id) REFERENCES council_session(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES role(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS decision_record (
  id TEXT PRIMARY KEY NOT NULL,
  mission_id TEXT NOT NULL,
  mission_run_id TEXT,
  council_session_id TEXT,
  approval_id TEXT,
  source_type TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'recorded',
  summary TEXT NOT NULL,
  rationale TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  alternatives_json TEXT NOT NULL DEFAULT '[]',
  unresolved_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE SET NULL,
  FOREIGN KEY (council_session_id) REFERENCES council_session(id) ON DELETE SET NULL,
  FOREIGN KEY (approval_id) REFERENCES approval(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS file_asset (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE SET NULL,
  UNIQUE (workspace_id, path)
);

CREATE TABLE IF NOT EXISTS artifact (
  id TEXT PRIMARY KEY NOT NULL,
  mission_id TEXT NOT NULL,
  mission_run_id TEXT,
  work_item_id TEXT,
  council_session_id TEXT,
  file_asset_id TEXT,
  created_by_agent_id TEXT,
  artifact_type TEXT NOT NULL,
  title TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  content_text TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL DEFAULT '{}',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE SET NULL,
  FOREIGN KEY (work_item_id) REFERENCES work_item(id) ON DELETE SET NULL,
  FOREIGN KEY (council_session_id) REFERENCES council_session(id) ON DELETE SET NULL,
  FOREIGN KEY (file_asset_id) REFERENCES file_asset(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_agent_id) REFERENCES agent(id) ON DELETE SET NULL,
  UNIQUE (mission_run_id, artifact_type, version)
);

CREATE TABLE IF NOT EXISTS external_effect (
  id TEXT PRIMARY KEY NOT NULL,
  mission_id TEXT NOT NULL,
  mission_run_id TEXT NOT NULL,
  work_item_id TEXT,
  agent_id TEXT,
  action_type TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'prepared',
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  request_json TEXT NOT NULL DEFAULT '{}',
  result_json TEXT,
  provider_request_id TEXT,
  replay_policy TEXT NOT NULL DEFAULT 'manual_reconcile',
  lease_epoch INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  approved_by TEXT,
  approved_at TEXT,
  executed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE CASCADE,
  FOREIGN KEY (work_item_id) REFERENCES work_item(id) ON DELETE SET NULL,
  FOREIGN KEY (agent_id) REFERENCES agent(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS event_log (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL,
  mission_id TEXT,
  mission_run_id TEXT,
  work_item_id TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor_id TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspace(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE,
  FOREIGN KEY (mission_run_id) REFERENCES mission_run(id) ON DELETE CASCADE,
  FOREIGN KEY (work_item_id) REFERENCES work_item(id) ON DELETE SET NULL,
  UNIQUE (source_type, source_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_mission_status ON mission(workspace_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_run_status ON mission_run(mission_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_run_lease ON mission_run(status, lease_expires_at);
CREATE INDEX IF NOT EXISTS idx_org_unit_scope ON org_unit(mission_run_id, unit_type, status);
CREATE INDEX IF NOT EXISTS idx_role_scope ON role(workspace_id, category, status);
CREATE INDEX IF NOT EXISTS idx_agent_scope ON agent(mission_run_id, status);
CREATE INDEX IF NOT EXISTS idx_work_item_run ON work_item(mission_run_id, sequence);
CREATE INDEX IF NOT EXISTS idx_work_item_status ON work_item(mission_id, status);
CREATE INDEX IF NOT EXISTS idx_step_run ON workflow_step(mission_run_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_transition_from ON workflow_transition(from_step_id, selected);
CREATE INDEX IF NOT EXISTS idx_review_run ON review(mission_run_id, status, review_type);
CREATE INDEX IF NOT EXISTS idx_approval_run ON approval(mission_run_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_council_run ON council_session(mission_run_id, status);
CREATE INDEX IF NOT EXISTS idx_council_message ON council_message(council_session_id, round, created_at);
CREATE INDEX IF NOT EXISTS idx_decision_mission ON decision_record(mission_id, source_type, created_at);
CREATE INDEX IF NOT EXISTS idx_artifact_mission ON artifact(mission_id, artifact_type, status);
CREATE INDEX IF NOT EXISTS idx_effect_run ON external_effect(mission_run_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_event_run ON event_log(mission_run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_file_mission ON file_asset(mission_id, kind, created_at);
`;

export function createV090Schema(database) {
  database.exec(V090_SCHEMA_SQL);
}

export function listUserTables(database) {
  return database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => String(row.name));
}

export function detectSchemaGeneration(database) {
  const tables = new Set(listUserTables(database));
  if (CORE_TABLES.every((table) => tables.has(table))) return "0.9.0";
  if (tables.has("Mission") && tables.has("GraphRun") && tables.has("MissionOrganization")) return "0.8.0";
  if (tables.size === 0) return "empty";
  return "unknown";
}
