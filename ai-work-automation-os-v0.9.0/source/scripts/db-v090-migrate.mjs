#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import process from "node:process";
import { CORE_TABLES, SCHEMA_VERSION, createV090Schema, detectSchemaGeneration, listUserTables } from "./db-v090-schema.mjs";

const args = new Set(process.argv.slice(2));
const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

function databasePath() {
  const explicit = valueAfter("--db");
  if (explicit) return resolve(explicit);
  const raw = process.env.DATABASE_URL ?? "file:../data/ai-work-automation.db";
  if (!raw.startsWith("file:")) throw new Error("v0.9.0 local migration supports file: SQLite URLs only");
  const relative = raw.slice(5);
  return resolve(process.cwd(), "prisma", relative);
}

function nowIso() {
  return new Date().toISOString();
}

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asJson(value, fallback) {
  if (value === null || value === undefined || value === "") return JSON.stringify(fallback);
  if (typeof value !== "string") return JSON.stringify(value);
  try {
    return JSON.stringify(JSON.parse(value));
  } catch {
    return JSON.stringify(fallback);
  }
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(String(value)) : fallback;
  } catch {
    return fallback;
  }
}

function microsFromUsd(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 1_000_000)) : 0;
}

function hash(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function safeId(prefix, id) {
  return `${prefix}_${String(id ?? randomUUID()).replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function tableExists(db, table) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

function rows(db, table) {
  if (!tableExists(db, table)) return [];
  return db.prepare(`SELECT * FROM "${table.replaceAll('"', '""')}"`).all();
}

function insert(db, table, record, { orIgnore = false } = {}) {
  const entries = Object.entries(record).filter(([, value]) => value !== undefined);
  const columns = entries.map(([key]) => `"${key}"`).join(", ");
  const placeholders = entries.map(() => "?").join(", ");
  const values = entries.map(([, value]) => (typeof value === "boolean" ? (value ? 1 : 0) : value));
  const verb = orIgnore ? "INSERT OR IGNORE" : "INSERT";
  db.prepare(`${verb} INTO "${table}" (${columns}) VALUES (${placeholders})`).run(...values);
}

function update(db, table, patch, whereColumn, whereValue) {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return;
  const assignments = entries.map(([key]) => `"${key}"=?`).join(", ");
  db.prepare(`UPDATE "${table}" SET ${assignments} WHERE "${whereColumn}"=?`).run(
    ...entries.map(([, value]) => (typeof value === "boolean" ? (value ? 1 : 0) : value)),
    whereValue
  );
}

function firstWorkspace(oldDb) {
  const organizations = rows(oldDb, "Organization");
  if (organizations.length > 0) return organizations;
  return [{
    id: "local_workspace",
    name: "AI Work Automation OS",
    slug: "ai-company",
    status: "active",
    createdAt: nowIso(),
    updatedAt: nowIso()
  }];
}

function makeEventWriter(db, defaultWorkspaceId) {
  const sequences = new Map();
  return ({ workspaceId = defaultWorkspaceId, missionId = null, missionRunId = null, workItemId = null, sourceType, sourceId, eventType, actorType = "system", actorId = null, severity = "info", message, data = {}, createdAt = null }) => {
    const key = `${sourceType}:${sourceId}`;
    const sequence = (sequences.get(key) ?? 0) + 1;
    sequences.set(key, sequence);
    insert(db, "event_log", {
      id: safeId("evt", `${key}_${sequence}_${randomUUID()}`),
      workspace_id: workspaceId,
      mission_id: missionId,
      mission_run_id: missionRunId,
      work_item_id: workItemId,
      source_type: sourceType,
      source_id: sourceId,
      sequence,
      event_type: eventType,
      actor_type: actorType,
      actor_id: actorId,
      severity,
      message: String(message ?? eventType),
      data_json: asJson(data, {}),
      created_at: toIso(createdAt) ?? nowIso()
    });
  };
}

function migrateV080(oldDb, newDb) {
  const migratedAt = nowIso();
  const organizations = firstWorkspace(oldDb);
  const workspaceMap = new Map();

  for (const organization of organizations) {
    const memberships = rows(oldDb, "OrganizationMembership").filter((row) => row.organizationId === organization.id);
    const workspaceId = String(organization.id);
    workspaceMap.set(String(organization.id), workspaceId);
    insert(newDb, "workspace", {
      id: workspaceId,
      name: organization.name ?? "AI Work Automation OS",
      slug: organization.slug ?? `workspace-${workspaceMap.size}`,
      schema_version: SCHEMA_VERSION,
      mode: "local",
      owner_principal_id: "local:owner",
      settings_json: JSON.stringify({
        migratedFrom: "0.8.0",
        migratedAt,
        previousStatus: organization.status ?? "active",
        legacyMemberships: memberships.map(({ principalId, role, status }) => ({ principalId, role, status }))
      }),
      created_at: toIso(organization.createdAt) ?? migratedAt,
      updated_at: toIso(organization.updatedAt) ?? migratedAt
    });
  }

  const defaultWorkspaceId = workspaceMap.values().next().value ?? "local_workspace";
  const event = makeEventWriter(newDb, defaultWorkspaceId);

  const workspaceForOrganization = (organizationId) => workspaceMap.get(String(organizationId ?? "")) ?? defaultWorkspaceId;

  const missions = rows(oldDb, "Mission");
  for (const mission of missions) {
    insert(newDb, "mission", {
      id: mission.id,
      workspace_id: workspaceForOrganization(mission.organizationId),
      title: mission.title ?? mission.objective?.slice(0, 100) ?? "Migrated mission",
      objective: mission.objective ?? "",
      mission_type: mission.missionType ?? "general",
      status: mission.status ?? "draft",
      priority: mission.priority ?? "normal",
      risk_level: mission.riskLevel ?? "GREEN",
      approval_mode: mission.approvalMode ?? "delegated",
      budget_micros: microsFromUsd(mission.budgetUsd),
      spent_micros: microsFromUsd(mission.estimatedCostUsd),
      success_json: asJson(mission.successCriteria, []),
      constraints_json: asJson(mission.constraints, []),
      input_json: asJson(mission.input, {}),
      current_stage: mission.currentStage ?? "intake",
      deadline: toIso(mission.deadline),
      completed_at: toIso(mission.completedAt),
      created_at: toIso(mission.createdAt) ?? migratedAt,
      updated_at: toIso(mission.updatedAt) ?? migratedAt
    });
  }

  const missionRuns = rows(oldDb, "MissionRun");
  const runByMission = new Map();
  for (const run of missionRuns) {
    const state = {
      migratedFrom: "0.8.0",
      requestHash: run.requestHash ?? null,
      graphRuntimeMode: run.graphRuntimeMode ?? "legacy",
      graphRuntimeDecision: parseJson(run.graphRuntimeDecisionJson, {}),
      organizationRuntimeMode: run.organizationRuntimeMode ?? "disabled",
      organizationRuntimeDecision: parseJson(run.organizationRuntimeDecisionJson, {}),
      queue: {
        messageId: run.queueMessageId ?? null,
        generation: run.queueGeneration ?? 0,
        lastEnqueuedAt: toIso(run.lastEnqueuedAt),
        lastReconciledAt: toIso(run.lastReconciledAt),
        reconcileCount: run.reconcileCount ?? 0
      }
    };
    insert(newDb, "mission_run", {
      id: run.id,
      mission_id: run.missionId,
      idempotency_key: run.idempotencyKey ?? `migrated-${run.id}`,
      requested_by: run.requestedBy ?? "local:owner",
      status: run.status ?? "queued",
      runtime_mode: "inline",
      current_step_key: null,
      state_json: JSON.stringify(state),
      budget_json: JSON.stringify({ source: "v0.8.0", hardLimitMicros: 0 }),
      result_json: run.result ? asJson(run.result, { text: String(run.result) }) : null,
      error_code: run.errorCode ?? null,
      error_message: run.errorMessage ?? null,
      attempt_count: run.attemptCount ?? 0,
      max_attempts: run.maxAttempts ?? 3,
      lease_owner: null,
      lease_epoch: run.leaseEpoch ?? 0,
      lease_expires_at: null,
      started_at: toIso(run.startedAt),
      completed_at: toIso(run.completedAt),
      created_at: toIso(run.createdAt) ?? migratedAt,
      updated_at: toIso(run.updatedAt) ?? migratedAt
    });
    const list = runByMission.get(run.missionId) ?? [];
    list.push(run);
    runByMission.set(run.missionId, list);
  }

  for (const [missionId, list] of runByMission) {
    list.sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));
  }

  function ensureRunForMission(missionId) {
    const existing = runByMission.get(missionId)?.at(-1);
    if (existing) return existing.id;
    const mission = missions.find((row) => row.id === missionId);
    if (!mission) throw new Error(`Cannot create migrated run for missing mission ${missionId}`);
    const runId = safeId("migrated_run", missionId);
    const row = {
      id: runId,
      missionId,
      createdAt: mission.createdAt ?? migratedAt
    };
    insert(newDb, "mission_run", {
      id: runId,
      mission_id: missionId,
      idempotency_key: `migration-${hash(missionId).slice(0, 24)}`,
      requested_by: "migration:v0.9.0",
      status: mission.status === "completed" ? "completed" : "migrated",
      runtime_mode: "inline",
      current_step_key: null,
      state_json: JSON.stringify({ migratedFrom: "0.8.0", generatedRun: true }),
      budget_json: JSON.stringify({ hardLimitMicros: microsFromUsd(mission.budgetUsd) }),
      result_json: null,
      error_code: null,
      error_message: null,
      attempt_count: 0,
      max_attempts: 1,
      lease_owner: null,
      lease_epoch: 0,
      lease_expires_at: null,
      started_at: toIso(mission.createdAt),
      completed_at: toIso(mission.completedAt),
      created_at: toIso(mission.createdAt) ?? migratedAt,
      updated_at: toIso(mission.updatedAt) ?? migratedAt
    });
    runByMission.set(missionId, [row]);
    return runId;
  }

  const graphRuns = rows(oldDb, "GraphRun");
  const graphRunToMissionRun = new Map(graphRuns.map((row) => [row.id, row.missionRunId]));
  const missionOrganizations = rows(oldDb, "MissionOrganization");
  const missionOrgMap = new Map(missionOrganizations.map((row) => [row.id, row]));

  const orgUnitIds = new Set();
  for (const team of rows(oldDb, "Team")) {
    const id = String(team.id);
    orgUnitIds.add(id);
    insert(newDb, "org_unit", {
      id,
      workspace_id: workspaceForOrganization(team.organizationId),
      mission_run_id: null,
      parent_id: null,
      unit_type: "team_template",
      key: team.slug ?? id,
      name: team.name ?? team.slug ?? "Team",
      objective: team.mission ?? "",
      status: team.status ?? "active",
      budget_micros: 0,
      spent_micros: 0,
      settings_json: JSON.stringify({ migratedFrom: "Team" }),
      created_at: toIso(team.createdAt) ?? migratedAt,
      updated_at: toIso(team.updatedAt) ?? migratedAt
    });
  }

  for (const department of rows(oldDb, "MissionDepartment")) {
    const missionOrg = missionOrgMap.get(department.missionOrganizationId);
    if (!missionOrg) continue;
    const id = String(department.id);
    orgUnitIds.add(id);
    insert(newDb, "org_unit", {
      id,
      workspace_id: workspaceForOrganization(missionOrg.organizationId),
      mission_run_id: missionOrg.missionRunId,
      parent_id: null,
      unit_type: "department",
      key: department.key ?? id,
      name: department.name ?? department.key ?? "Department",
      objective: department.mission ?? "",
      status: department.status ?? "active",
      budget_micros: Number(department.budgetLimitMicros ?? 0),
      spent_micros: Number(department.budgetUsedMicros ?? 0),
      settings_json: JSON.stringify({
        requiredCapabilities: parseJson(department.requiredCapabilities, []),
        completionCriteria: parseJson(department.completionCriteria, []),
        leaderRoleKey: department.leaderRoleKey ?? null,
        depth: department.depth ?? 1
      }),
      created_at: toIso(department.createdAt) ?? migratedAt,
      updated_at: toIso(department.updatedAt) ?? migratedAt
    });
  }

  const missionTeams = rows(oldDb, "MissionTeam");
  const pendingTeamParents = [];
  // Insert first without team-to-team parents. SQLite validates foreign keys per
  // statement, so a two-pass write avoids depending on the legacy row order.
  for (const team of missionTeams) {
    const missionOrg = missionOrgMap.get(team.missionOrganizationId);
    if (!missionOrg) continue;
    const id = String(team.id);
    orgUnitIds.add(id);
    const departmentParent = team.departmentId && orgUnitIds.has(String(team.departmentId))
      ? String(team.departmentId)
      : null;
    insert(newDb, "org_unit", {
      id,
      workspace_id: workspaceForOrganization(missionOrg.organizationId),
      mission_run_id: missionOrg.missionRunId,
      parent_id: departmentParent,
      unit_type: "team",
      key: team.key ?? id,
      name: team.name ?? team.key ?? "Team",
      objective: team.objective ?? "",
      status: team.status ?? "active",
      budget_micros: Number(team.budgetLimitMicros ?? 0),
      spent_micros: Number(team.budgetUsedMicros ?? 0),
      settings_json: JSON.stringify({
        requiredCapabilities: parseJson(team.requiredCapabilities, []),
        completionCriteria: parseJson(team.completionCriteria, []),
        leadRoleKey: team.leadRoleKey ?? null,
        graphSpecKey: team.graphSpecKey ?? null,
        minMembers: team.minMembers ?? 0,
        maxMembers: team.maxMembers ?? 0,
        depth: team.depth ?? 2
      }),
      created_at: toIso(team.createdAt) ?? migratedAt,
      updated_at: toIso(team.updatedAt) ?? migratedAt
    });
    if (team.parentTeamId) pendingTeamParents.push([id, String(team.parentTeamId)]);
  }
  for (const [teamId, parentId] of pendingTeamParents) {
    if (orgUnitIds.has(parentId)) update(newDb, "org_unit", { parent_id: parentId }, "id", teamId);
  }

  const capabilities = new Map(rows(oldDb, "CapabilityAsset").map((row) => [row.id, row]));
  const capabilitiesByRole = new Map();
  for (const link of rows(oldDb, "RoleCapability")) {
    const capability = capabilities.get(link.capabilityId);
    if (!capability) continue;
    const list = capabilitiesByRole.get(link.roleId) ?? [];
    list.push({
      key: capability.name,
      kind: capability.kind,
      version: capability.version,
      required: Boolean(link.required),
      riskLevel: capability.riskLevel,
      configuration: parseJson(link.configuration, {})
    });
    capabilitiesByRole.set(link.roleId, list);
  }

  const roleIdMap = new Map();
  const usedRoleIds = new Set();
  for (const role of rows(oldDb, "AgentRole")) {
    const id = String(role.id);
    usedRoleIds.add(id);
    roleIdMap.set(`AgentRole:${role.id}`, id);
    const capabilityList = [
      ...parseJson(role.requiredCapabilities, []),
      ...(capabilitiesByRole.get(role.id) ?? [])
    ];
    insert(newDb, "role", {
      id,
      workspace_id: workspaceForOrganization(rows(oldDb, "Team").find((team) => team.id === role.teamId)?.organizationId),
      org_unit_id: orgUnitIds.has(String(role.teamId)) ? role.teamId : null,
      key: role.slug ?? id,
      title: role.name ?? role.slug ?? "Role",
      category: role.category ?? "specialist",
      responsibilities_json: asJson(role.responsibilities, []),
      capabilities_json: JSON.stringify(capabilityList),
      permissions_json: asJson(role.permissions, []),
      tool_policy_json: JSON.stringify({ skills: parseJson(role.skills, []), plugins: parseJson(role.plugins, []), modelPolicy: role.modelPolicy ?? null, concurrencyLimit: role.concurrencyLimit ?? 1 }),
      model_class: "balanced",
      is_lead: Boolean(role.isLead),
      is_verifier: String(role.category ?? "").toLowerCase().includes("verifier"),
      status: role.status ?? "active",
      created_at: toIso(role.createdAt) ?? migratedAt,
      updated_at: toIso(role.updatedAt) ?? migratedAt
    });
  }

  for (const role of rows(oldDb, "RoleDefinition")) {
    const missionOrg = missionOrgMap.get(role.missionOrganizationId);
    if (!missionOrg) continue;
    let id = String(role.id);
    if (usedRoleIds.has(id)) id = safeId("roledef", id);
    usedRoleIds.add(id);
    roleIdMap.set(`RoleDefinition:${role.id}`, id);
    const spec = parseJson(role.specJson, {});
    insert(newDb, "role", {
      id,
      workspace_id: workspaceForOrganization(missionOrg.organizationId),
      org_unit_id: role.teamId ?? role.departmentId ?? null,
      key: role.key ?? id,
      title: role.title ?? role.key ?? "Role",
      category: role.category ?? "specialist",
      responsibilities_json: JSON.stringify(spec.responsibilities ?? []),
      capabilities_json: JSON.stringify(spec.capabilities ?? []),
      permissions_json: JSON.stringify(spec.permissions ?? []),
      tool_policy_json: JSON.stringify({
        toolPolicyId: role.toolPolicyId ?? null,
        mayCreateRoles: Boolean(role.mayCreateRoles),
        mayCreateTeams: Boolean(role.mayCreateTeams),
        maxDirectReports: role.maxDirectReports ?? 0,
        reportsToRoleKey: role.reportsToRoleKey ?? null,
        budgetAuthorityMicros: Number(role.budgetAuthorityMicros ?? 0)
      }),
      model_class: role.modelClass ?? "balanced",
      is_lead: Boolean(role.isLead),
      is_verifier: Boolean(role.isVerifier),
      status: role.status ?? "active",
      created_at: toIso(role.createdAt) ?? migratedAt,
      updated_at: toIso(role.updatedAt) ?? migratedAt
    });
  }

  const agentIds = new Set();
  const pendingManagers = [];
  // Insert agents first, then attach reporting lines. This makes migration
  // independent of whether a manager appeared before or after a report.
  for (const agent of rows(oldDb, "AgentInstance")) {
    const missionOrg = missionOrgMap.get(agent.missionOrganizationId);
    if (!missionOrg) continue;
    const roleId = roleIdMap.get(`RoleDefinition:${agent.roleDefinitionId}`);
    if (!roleId) continue;
    const id = String(agent.id);
    agentIds.add(id);
    const orgUnitId = agent.teamId ?? agent.departmentId ?? null;
    insert(newDb, "agent", {
      id,
      workspace_id: workspaceForOrganization(missionOrg.organizationId),
      mission_run_id: missionOrg.missionRunId,
      org_unit_id: orgUnitId && orgUnitIds.has(String(orgUnitId)) ? String(orgUnitId) : null,
      role_id: roleId,
      manager_agent_id: null,
      name: agent.title ?? id,
      provider: agent.provider ?? null,
      model: agent.model ?? null,
      status: agent.status ?? "active",
      capabilities_json: asJson(agent.capabilitiesJson, []),
      permissions_json: asJson(agent.permissionsJson, []),
      context_json: asJson(agent.contextScopeJson, []),
      budget_micros: Number(agent.budgetLimitMicros ?? 0),
      spent_micros: Number(agent.budgetUsedMicros ?? 0),
      temporary: Boolean(agent.temporary),
      activated_at: toIso(agent.activatedAt),
      retired_at: toIso(agent.retiredAt),
      created_at: toIso(agent.createdAt) ?? migratedAt,
      updated_at: toIso(agent.updatedAt) ?? migratedAt
    });
    if (agent.managerAgentId) pendingManagers.push([id, String(agent.managerAgentId)]);
  }
  for (const [agentId, managerId] of pendingManagers) {
    if (agentIds.has(managerId)) update(newDb, "agent", { manager_agent_id: managerId }, "id", agentId);
  }

  const workItems = rows(oldDb, "WorkItem");
  const workItemRun = new Map();
  for (const item of workItems) {
    const runId = (item.graphRunId && graphRunToMissionRun.get(item.graphRunId)) || ensureRunForMission(item.missionId);
    workItemRun.set(item.id, runId);
    insert(newDb, "work_item", {
      id: item.id,
      mission_id: item.missionId,
      mission_run_id: runId,
      parent_id: null,
      org_unit_id: item.missionTeamId && orgUnitIds.has(String(item.missionTeamId)) ? String(item.missionTeamId) : null,
      agent_id: item.agentInstanceId && agentIds.has(String(item.agentInstanceId)) ? String(item.agentInstanceId) : null,
      key: item.taskKey ?? `work-${item.sequence}`,
      sequence: item.sequence ?? 0,
      title: item.title ?? item.kind ?? "Work item",
      objective: item.objective ?? "",
      work_type: item.kind ?? item.actionKind ?? "general",
      status: item.status ?? "pending",
      risk_level: item.riskLevel ?? "GREEN",
      input_json: asJson(item.input, {}),
      output_json: item.output ? asJson(item.output, { text: String(item.output) }) : null,
      criteria_json: asJson(item.acceptanceCriteria, []),
      evidence_json: "[]",
      cost_micros: microsFromUsd(item.estimatedCostUsd),
      attempt_count: item.attemptCount ?? 0,
      max_attempts: item.maxAttempts ?? 2,
      started_at: toIso(item.startedAt),
      completed_at: toIso(item.completedAt),
      created_at: toIso(item.createdAt) ?? migratedAt,
      updated_at: toIso(item.updatedAt) ?? migratedAt
    });
  }

  const graphNodeStepId = new Map();
  for (const node of rows(oldDb, "GraphNodeRun")) {
    const runId = graphRunToMissionRun.get(node.graphRunId);
    if (!runId) continue;
    const id = safeId("step_graph", node.id);
    graphNodeStepId.set(node.id, id);
    insert(newDb, "workflow_step", {
      id,
      mission_run_id: runId,
      work_item_id: workItems.find((item) => item.sourceNodeRunId === node.id)?.id ?? null,
      org_unit_id: null,
      agent_id: null,
      key: node.nodeKey ?? node.handlerId ?? "legacy-node",
      instance_key: node.instanceKey ?? "root",
      step_type: node.handlerId ?? node.nodeKind ?? "legacy_graph_node",
      role_key: node.role ?? null,
      status: node.status ?? "pending",
      attempt: node.attempt ?? 1,
      max_attempts: 3,
      input_json: asJson(node.inputJson, {}),
      output_json: node.outputJson ? asJson(node.outputJson, {}) : null,
      usage_json: asJson(node.usageJson, {}),
      failure_json: node.errorCode || node.errorMessage ? JSON.stringify({ errorCode: node.errorCode, errorMessage: node.errorMessage }) : null,
      started_at: toIso(node.startedAt),
      completed_at: toIso(node.completedAt),
      created_at: toIso(node.createdAt) ?? migratedAt,
      updated_at: toIso(node.updatedAt) ?? migratedAt
    });
  }

  for (const dispatch of rows(oldDb, "Dispatch")) {
    const runId = workItemRun.get(dispatch.workItemId);
    if (!runId) continue;
    insert(newDb, "workflow_step", {
      id: safeId("step_dispatch", dispatch.id),
      mission_run_id: runId,
      work_item_id: dispatch.workItemId,
      org_unit_id: null,
      agent_id: null,
      key: `dispatch-${dispatch.workItemId}`,
      instance_key: String(dispatch.attempt ?? 1),
      step_type: "dispatch",
      role_key: dispatch.assignee ?? dispatch.executor ?? null,
      status: dispatch.status ?? "queued",
      attempt: dispatch.attempt ?? 1,
      max_attempts: dispatch.attempt ?? 1,
      input_json: asJson(dispatch.input, {}),
      output_json: dispatch.output ? asJson(dispatch.output, { text: String(dispatch.output) }) : null,
      usage_json: JSON.stringify({ costMicros: microsFromUsd(dispatch.costUsd), latencyMs: dispatch.latencyMs ?? 0, provider: dispatch.provider ?? null }),
      failure_json: dispatch.errorCode || dispatch.errorMessage ? JSON.stringify({ errorCode: dispatch.errorCode, errorMessage: dispatch.errorMessage }) : null,
      started_at: toIso(dispatch.startedAt),
      completed_at: toIso(dispatch.completedAt),
      created_at: toIso(dispatch.createdAt) ?? migratedAt,
      updated_at: toIso(dispatch.updatedAt) ?? migratedAt
    });
  }

  for (const invocation of rows(oldDb, "GraphRoleInvocation")) {
    const runId = graphRunToMissionRun.get(invocation.graphRunId);
    if (!runId) continue;
    insert(newDb, "workflow_step", {
      id: safeId("step_role", invocation.id),
      mission_run_id: runId,
      work_item_id: null,
      org_unit_id: null,
      agent_id: null,
      key: `role-${invocation.role}`,
      instance_key: invocation.taskId ?? invocation.id,
      step_type: "role_invocation",
      role_key: invocation.role ?? null,
      status: invocation.status ?? "completed",
      attempt: Math.max(1, invocation.attemptCount ?? 1),
      max_attempts: Math.max(1, invocation.attemptCount ?? 1),
      input_json: JSON.stringify({ requestHash: invocation.requestHash, selectionHash: invocation.selectionHash }),
      output_json: invocation.outputJson ? asJson(invocation.outputJson, {}) : null,
      usage_json: asJson(invocation.usageJson, {}),
      failure_json: invocation.errorCode || invocation.errorMessage ? JSON.stringify({ errorCode: invocation.errorCode, errorMessage: invocation.errorMessage }) : null,
      started_at: toIso(invocation.startedAt),
      completed_at: toIso(invocation.completedAt),
      created_at: toIso(invocation.createdAt) ?? migratedAt,
      updated_at: toIso(invocation.updatedAt) ?? migratedAt
    });
  }

  const transitionsByRun = new Map();
  for (const graphEvent of rows(oldDb, "GraphEvent")) {
    const runId = graphRunToMissionRun.get(graphEvent.graphRunId);
    if (!runId) continue;
    const sequence = (transitionsByRun.get(runId) ?? 0) + 1;
    transitionsByRun.set(runId, sequence);
    if (["edge.selected", "transition.selected", "route.selected"].includes(graphEvent.type)) {
      const payload = parseJson(graphEvent.payloadJson, {});
      insert(newDb, "workflow_transition", {
        id: safeId("transition", graphEvent.id),
        mission_run_id: runId,
        from_step_id: payload.fromNodeRunId ? graphNodeStepId.get(payload.fromNodeRunId) ?? null : null,
        to_step_id: payload.toNodeRunId ? graphNodeStepId.get(payload.toNodeRunId) ?? null : null,
        sequence,
        condition_type: graphEvent.reasonCode ?? "legacy",
        condition_json: asJson(graphEvent.payloadJson, {}),
        result: graphEvent.type,
        selected: true,
        created_at: toIso(graphEvent.createdAt) ?? migratedAt
      });
    }
    event({
      workspaceId: workspaceForOrganization(graphRuns.find((run) => run.id === graphEvent.graphRunId)?.organizationId),
      missionId: graphRuns.find((run) => run.id === graphEvent.graphRunId)?.missionId ?? null,
      missionRunId: runId,
      sourceType: "workflow",
      sourceId: runId,
      eventType: graphEvent.type ?? "graph.event",
      actorId: graphEvent.actor ?? null,
      message: graphEvent.reasonCode ?? graphEvent.type ?? "Workflow event",
      data: parseJson(graphEvent.payloadJson, {}),
      createdAt: graphEvent.createdAt
    });
  }

  const reviewIdMap = new Map();
  for (const evaluation of rows(oldDb, "Evaluation")) {
    const runId = evaluation.graphNodeRunId
      ? graphRunToMissionRun.get(rows(oldDb, "GraphNodeRun").find((node) => node.id === evaluation.graphNodeRunId)?.graphRunId)
      : workItemRun.get(evaluation.workItemId) ?? ensureRunForMission(evaluation.missionId);
    if (!runId) continue;
    reviewIdMap.set(evaluation.id, evaluation.id);
    insert(newDb, "review", {
      id: evaluation.id,
      mission_id: evaluation.missionId,
      mission_run_id: runId,
      work_item_id: evaluation.workItemId ?? null,
      workflow_step_id: evaluation.graphNodeRunId ? graphNodeStepId.get(evaluation.graphNodeRunId) ?? null : null,
      reviewer_agent_id: null,
      review_type: evaluation.verificationProfile ?? "independent_quality",
      status: evaluation.status ?? "completed",
      verdict: String(evaluation.status ?? "").toLowerCase().includes("pass") ? "passed" : "failed",
      severity: "info",
      score: Number(evaluation.score ?? 0),
      confidence: Math.min(1, Math.max(0, Number(evaluation.score ?? 0) / 100)),
      criteria_json: asJson(evaluation.criteria, []),
      evidence_json: asJson(evaluation.evidence, []),
      failure_json: asJson(evaluation.findings, []),
      summary: evaluation.evaluator ?? "Migrated evaluation",
      completed_at: toIso(evaluation.createdAt),
      created_at: toIso(evaluation.createdAt) ?? migratedAt,
      updated_at: toIso(evaluation.createdAt) ?? migratedAt
    });
  }

  for (const failure of rows(oldDb, "FailurePacket")) {
    const graphRun = graphRuns.find((row) => row.id === failure.graphRunId);
    if (!graphRun) continue;
    insert(newDb, "review", {
      id: safeId("review_failure", failure.id),
      mission_id: graphRun.missionId,
      mission_run_id: graphRun.missionRunId,
      work_item_id: null,
      workflow_step_id: failure.nodeRunId ? graphNodeStepId.get(failure.nodeRunId) ?? null : null,
      reviewer_agent_id: null,
      review_type: "failure_packet",
      status: failure.status ?? "open",
      verdict: failure.blocking ? "failed" : "warning",
      severity: failure.severity ?? "medium",
      score: 0,
      confidence: 1,
      criteria_json: JSON.stringify([{ checkId: failure.checkId, expected: failure.expected }]),
      evidence_json: asJson(failure.evidenceRefsJson, []),
      failure_json: JSON.stringify([{ fingerprint: failure.fingerprint, failureType: failure.failureType, observed: failure.observed, recommendedRoute: failure.recommendedRoute, retryable: Boolean(failure.retryable), occurrence: failure.occurrence }]),
      summary: `${failure.failureType}: ${failure.observed}`,
      completed_at: toIso(failure.resolvedAt),
      created_at: toIso(failure.createdAt) ?? migratedAt,
      updated_at: toIso(failure.updatedAt) ?? migratedAt
    });
  }

  for (const shadow of rows(oldDb, "GraphShadowAssessment")) {
    const run = missionRuns.find((row) => row.id === shadow.missionRunId);
    if (!run) continue;
    insert(newDb, "review", {
      id: safeId("review_shadow", shadow.id),
      mission_id: run.missionId,
      mission_run_id: shadow.missionRunId,
      work_item_id: null,
      workflow_step_id: null,
      reviewer_agent_id: null,
      review_type: "shadow_assessment",
      status: shadow.status ?? "completed",
      verdict: shadow.canaryEligible ? "passed" : "needs_review",
      severity: shadow.riskCount > 0 ? "medium" : "info",
      score: shadow.canaryEligible ? 100 : 50,
      confidence: 1,
      criteria_json: "[]",
      evidence_json: "[]",
      failure_json: JSON.stringify({ mismatchCount: shadow.mismatchCount, riskCount: shadow.riskCount }),
      summary: "Migrated shadow assessment",
      completed_at: toIso(shadow.updatedAt),
      created_at: toIso(shadow.createdAt) ?? migratedAt,
      updated_at: toIso(shadow.updatedAt) ?? migratedAt
    });
  }

  function approvalFromLegacy({ id, missionId, runId, workItemId = null, orgUnitId = null, agentId = null, type, status, riskLevel, targetType, targetId, requestedBy, decidedBy = null, scopeHash, request, decision = null, expiresAt = null, decidedAt = null, createdAt = null, updatedAt = null }) {
    if (!missionId || !runId) return;
    insert(newDb, "approval", {
      id,
      mission_id: missionId,
      mission_run_id: runId,
      work_item_id: workItemId,
      org_unit_id: orgUnitId,
      agent_id: agentId,
      approval_type: type,
      status: status ?? "pending",
      risk_level: riskLevel ?? "YELLOW",
      target_type: targetType,
      target_id: String(targetId),
      requested_by: requestedBy ?? "system",
      decided_by: decidedBy,
      scope_hash: scopeHash || hash({ type, targetType, targetId, request }),
      request_json: asJson(request, {}),
      decision_json: decision ? asJson(decision, {}) : null,
      expires_at: toIso(expiresAt),
      decided_at: toIso(decidedAt),
      created_at: toIso(createdAt) ?? migratedAt,
      updated_at: toIso(updatedAt) ?? toIso(createdAt) ?? migratedAt
    }, { orIgnore: true });
  }

  for (const decision of rows(oldDb, "DecisionRecord")) {
    const runId = decision.graphRunId ? graphRunToMissionRun.get(decision.graphRunId) : workItemRun.get(decision.workItemId) ?? ensureRunForMission(decision.missionId);
    approvalFromLegacy({
      id: safeId("approval_decision", decision.id),
      missionId: decision.missionId,
      runId,
      workItemId: decision.workItemId ?? null,
      type: decision.classification ?? "executive",
      status: decision.status ?? "pending",
      riskLevel: decision.authority === "ceo" ? "RED" : "YELLOW",
      targetType: decision.workItemId ? "work_item" : "mission_run",
      targetId: decision.workItemId ?? runId,
      requestedBy: decision.authority ?? "system",
      decidedBy: decision.decidedBy ?? null,
      scopeHash: decision.scopeHash ?? hash(decision.decisionKey ?? decision.id),
      request: { question: decision.question, options: parseJson(decision.options, []), policySnapshot: parseJson(decision.policySnapshot, {}) },
      decision: decision.resolution ? { resolution: decision.resolution, rationale: decision.rationale } : null,
      expiresAt: decision.expiresAt,
      decidedAt: decision.resolvedAt,
      createdAt: decision.createdAt,
      updatedAt: decision.resolvedAt ?? decision.createdAt
    });
  }

  for (const request of rows(oldDb, "StaffingRequest")) {
    const missionOrg = missionOrgMap.get(request.missionOrganizationId);
    if (!missionOrg) continue;
    approvalFromLegacy({
      id: safeId("approval_staffing", request.id),
      missionId: missionOrg.missionId,
      runId: missionOrg.missionRunId,
      orgUnitId: request.teamId,
      agentId: request.requestedByAgentId,
      type: "staffing",
      status: request.status,
      riskLevel: request.riskLevel,
      targetType: "agent",
      targetId: request.fulfilledAgentId ?? request.requestKey,
      requestedBy: request.requestedByAgentId,
      decidedBy: request.decidedBy,
      scopeHash: request.scopeHash,
      request: parseJson(request.requestJson, {}),
      decision: request.resolution ? { resolution: request.resolution, rationale: request.rationale, reusableAgentId: request.reusableAgentId, fulfilledAgentId: request.fulfilledAgentId } : null,
      decidedAt: request.decidedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    });
  }

  for (const request of rows(oldDb, "TeamFormationRequest")) {
    const missionOrg = missionOrgMap.get(request.missionOrganizationId);
    if (!missionOrg) continue;
    approvalFromLegacy({
      id: safeId("approval_team", request.id),
      missionId: missionOrg.missionId,
      runId: missionOrg.missionRunId,
      orgUnitId: request.departmentId,
      agentId: request.requestedByAgentId,
      type: "team_formation",
      status: request.status,
      riskLevel: request.riskLevel,
      targetType: "org_unit",
      targetId: request.formedTeamId ?? request.requestKey,
      requestedBy: request.requestedByAgentId,
      decidedBy: request.decidedBy,
      scopeHash: request.scopeHash,
      request: parseJson(request.requestJson, {}),
      decision: request.resolution ? { resolution: request.resolution, rationale: request.rationale, formedTeamId: request.formedTeamId } : null,
      decidedAt: request.decidedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt
    });
  }

  const councilSessionIdMap = new Map();
  for (const session of rows(oldDb, "CouncilSession")) {
    let missionId = session.missionId;
    if (!missionId && missions.length > 0) missionId = missions[0].id;
    if (!missionId) continue;
    const id = session.id;
    councilSessionIdMap.set(session.id, id);
    const linkedRun = runByMission.get(missionId)?.at(-1)?.id ?? null;
    insert(newDb, "council_session", {
      id,
      mission_id: missionId,
      mission_run_id: linkedRun,
      topic: session.question ?? "Council session",
      status: session.status ?? "draft",
      current_round: rows(oldDb, "CouncilRound").filter((round) => round.sessionId === session.id).reduce((max, round) => Math.max(max, round.roundNumber ?? 0), 0),
      budget_micros: microsFromUsd(session.budgetUsd),
      cost_micros: microsFromUsd(session.estimatedCostUsd),
      config_json: JSON.stringify({ participants: parseJson(session.participants, []), source: session.source ?? "native" }),
      completed_at: toIso(session.completedAt),
      created_at: toIso(session.createdAt) ?? migratedAt,
      updated_at: toIso(session.updatedAt) ?? migratedAt
    });
  }

  const rounds = new Map(rows(oldDb, "CouncilRound").map((round) => [round.id, round]));
  for (const response of rows(oldDb, "ParticipantResponse")) {
    if (!councilSessionIdMap.has(response.sessionId)) continue;
    const round = response.roundId ? rounds.get(response.roundId) : null;
    insert(newDb, "council_message", {
      id: response.id,
      council_session_id: response.sessionId,
      role_id: null,
      agent_id: null,
      round: round?.roundNumber ?? 1,
      speaker_type: response.provider ?? "model",
      message_type: round?.type ?? response.status ?? "response",
      content: response.content ?? "",
      metadata_json: JSON.stringify({ role: response.role, model: response.model, latencyMs: response.latencyMs, errorCode: response.errorCode, raw: parseJson(response.rawMetadata, null) }),
      input_tokens: response.promptTokens ?? 0,
      output_tokens: response.outputTokens ?? 0,
      cost_micros: microsFromUsd(response.costUsd),
      created_at: toIso(response.createdAt) ?? migratedAt
    });
  }

  for (const consensus of rows(oldDb, "Consensus")) {
    const session = rows(oldDb, "CouncilSession").find((row) => row.id === consensus.sessionId);
    const missionId = session?.missionId ?? missions[0]?.id;
    if (!missionId) continue;
    const runId = runByMission.get(missionId)?.at(-1)?.id ?? null;
    insert(newDb, "decision_record", {
      id: consensus.id,
      mission_id: missionId,
      mission_run_id: runId,
      council_session_id: consensus.sessionId,
      approval_id: null,
      source_type: "council",
      decision_type: "consensus",
      status: "recorded",
      summary: consensus.userEditedDecision ?? consensus.decision ?? "",
      rationale: "Migrated AI Council consensus",
      confidence: Number(consensus.confidence ?? 0),
      alternatives_json: asJson(consensus.conflicts, []),
      unresolved_json: asJson(consensus.conflicts, []),
      evidence_json: asJson(consensus.agreements, []),
      created_at: toIso(consensus.createdAt) ?? migratedAt,
      updated_at: toIso(consensus.updatedAt) ?? migratedAt
    });
  }

  for (const legacyDecision of rows(oldDb, "DecisionRecord")) {
    const runId = legacyDecision.graphRunId ? graphRunToMissionRun.get(legacyDecision.graphRunId) : workItemRun.get(legacyDecision.workItemId) ?? ensureRunForMission(legacyDecision.missionId);
    insert(newDb, "decision_record", {
      id: legacyDecision.id,
      mission_id: legacyDecision.missionId,
      mission_run_id: runId,
      council_session_id: null,
      approval_id: safeId("approval_decision", legacyDecision.id),
      source_type: "approval",
      decision_type: legacyDecision.classification ?? "executive",
      status: legacyDecision.status ?? "pending",
      summary: legacyDecision.resolution ?? legacyDecision.question ?? "Decision",
      rationale: legacyDecision.rationale ?? "",
      confidence: legacyDecision.status === "resolved" ? 1 : 0,
      alternatives_json: asJson(legacyDecision.options, []),
      unresolved_json: legacyDecision.status === "pending" ? JSON.stringify([legacyDecision.question]) : "[]",
      evidence_json: "[]",
      created_at: toIso(legacyDecision.createdAt) ?? migratedAt,
      updated_at: toIso(legacyDecision.resolvedAt) ?? toIso(legacyDecision.createdAt) ?? migratedAt
    }, { orIgnore: true });
  }

  for (const artifact of rows(oldDb, "Artifact")) {
    const session = rows(oldDb, "CouncilSession").find((row) => row.id === artifact.sessionId);
    const missionId = session?.missionId ?? missions[0]?.id;
    if (!missionId) continue;
    const runId = runByMission.get(missionId)?.at(-1)?.id ?? null;
    insert(newDb, "artifact", {
      id: artifact.id,
      mission_id: missionId,
      mission_run_id: runId,
      work_item_id: null,
      council_session_id: artifact.sessionId,
      file_asset_id: null,
      created_by_agent_id: null,
      artifact_type: artifact.type ?? "council_artifact",
      title: artifact.type ?? "Council artifact",
      version: artifact.version ?? 1,
      status: "final",
      content_text: artifact.markdown ?? "",
      content_json: "{}",
      evidence_json: "[]",
      created_at: toIso(artifact.createdAt) ?? migratedAt,
      updated_at: toIso(artifact.createdAt) ?? migratedAt
    }, { orIgnore: true });
  }

  for (const deliverable of rows(oldDb, "Deliverable")) {
    const runId = deliverable.graphRunId ? graphRunToMissionRun.get(deliverable.graphRunId) : runByMission.get(deliverable.missionId)?.at(-1)?.id ?? null;
    insert(newDb, "artifact", {
      id: deliverable.id,
      mission_id: deliverable.missionId,
      mission_run_id: runId,
      work_item_id: null,
      council_session_id: null,
      file_asset_id: null,
      created_by_agent_id: null,
      artifact_type: deliverable.type ?? "deliverable",
      title: deliverable.type ?? "Deliverable",
      version: deliverable.version ?? 1,
      status: deliverable.status ?? "draft",
      content_text: deliverable.markdown ?? "",
      content_json: asJson(deliverable.data, {}),
      evidence_json: JSON.stringify({ schemaVersion: deliverable.schemaVersion, sourceCheckpointId: deliverable.sourceCheckpointId, stateHash: deliverable.stateHash }),
      created_at: toIso(deliverable.createdAt) ?? migratedAt,
      updated_at: toIso(deliverable.createdAt) ?? migratedAt
    }, { orIgnore: true });
  }

  for (const effect of rows(oldDb, "ExternalEffect")) {
    const runId = effect.missionRunId ?? workItemRun.get(effect.workItemId) ?? ensureRunForMission(effect.missionId);
    insert(newDb, "external_effect", {
      id: effect.id,
      mission_id: effect.missionId,
      mission_run_id: runId,
      work_item_id: effect.workItemId ?? null,
      agent_id: null,
      action_type: effect.actionKind ?? effect.operation ?? "external_action",
      target: effect.operation ?? effect.actionKind ?? "external",
      status: effect.status ?? "prepared",
      idempotency_key: effect.effectKey ?? safeId("effect", effect.id),
      request_hash: effect.requestHash ?? hash(effect.argumentsJson ?? effect.id),
      request_json: asJson(effect.argumentsJson, {}),
      result_json: effect.result ? asJson(effect.result, { text: String(effect.result) }) : null,
      provider_request_id: effect.providerRequestId ?? null,
      replay_policy: effect.replayPolicy ?? "manual_reconcile",
      lease_epoch: effect.leaseEpoch ?? 0,
      error_code: effect.errorCode ?? null,
      error_message: effect.errorMessage ?? null,
      approved_by: effect.reconciledBy ?? null,
      approved_at: toIso(effect.reconciledAt),
      executed_at: toIso(effect.completedAt),
      created_at: toIso(effect.createdAt) ?? migratedAt,
      updated_at: toIso(effect.updatedAt) ?? migratedAt
    });
  }

  for (const audit of rows(oldDb, "AuditEvent")) {
    const session = audit.sessionId ? rows(oldDb, "CouncilSession").find((row) => row.id === audit.sessionId) : null;
    const missionId = session?.missionId ?? null;
    event({
      workspaceId: missionId ? workspaceForOrganization(missions.find((row) => row.id === missionId)?.organizationId) : defaultWorkspaceId,
      missionId,
      missionRunId: missionId ? runByMission.get(missionId)?.at(-1)?.id ?? null : null,
      sourceType: "council",
      sourceId: audit.sessionId ?? "global",
      eventType: audit.type ?? "audit",
      message: audit.message ?? audit.type ?? "Audit event",
      data: parseJson(audit.metadata, {}),
      createdAt: audit.createdAt
    });
  }

  for (const missionEvent of rows(oldDb, "MissionEvent")) {
    event({
      workspaceId: workspaceForOrganization(missions.find((row) => row.id === missionEvent.missionId)?.organizationId),
      missionId: missionEvent.missionId,
      missionRunId: runByMission.get(missionEvent.missionId)?.at(-1)?.id ?? null,
      sourceType: "mission",
      sourceId: missionEvent.missionId,
      eventType: missionEvent.type ?? "mission.event",
      actorId: missionEvent.actor ?? null,
      message: missionEvent.message ?? missionEvent.type ?? "Mission event",
      data: parseJson(missionEvent.metadata, {}),
      createdAt: missionEvent.createdAt
    });
  }

  for (const orgEvent of rows(oldDb, "OrganizationRuntimeEvent")) {
    const missionOrg = missionOrgMap.get(orgEvent.missionOrganizationId);
    if (!missionOrg) continue;
    event({
      workspaceId: workspaceForOrganization(missionOrg.organizationId),
      missionId: missionOrg.missionId,
      missionRunId: missionOrg.missionRunId,
      sourceType: "organization",
      sourceId: missionOrg.missionRunId,
      eventType: orgEvent.type ?? "organization.event",
      actorId: orgEvent.actor ?? null,
      message: orgEvent.message ?? orgEvent.type ?? "Organization event",
      data: parseJson(orgEvent.payloadJson, {}),
      createdAt: orgEvent.createdAt
    });
  }

  for (const checkpoint of rows(oldDb, "GraphCheckpoint")) {
    const graphRun = graphRuns.find((row) => row.id === checkpoint.graphRunId);
    if (!graphRun) continue;
    event({
      workspaceId: workspaceForOrganization(graphRun.organizationId),
      missionId: graphRun.missionId,
      missionRunId: graphRun.missionRunId,
      sourceType: "checkpoint",
      sourceId: graphRun.missionRunId,
      eventType: "workflow.checkpoint",
      message: checkpoint.reason ?? "Workflow checkpoint",
      data: { stateVersion: checkpoint.stateVersion, stateHash: checkpoint.stateHash, state: parseJson(checkpoint.stateJson, {}) },
      createdAt: checkpoint.createdAt
    });
  }

  for (const plan of rows(oldDb, "OrganizationPlanRecord")) {
    const missionOrg = missionOrgMap.get(plan.missionOrganizationId);
    if (!missionOrg) continue;
    insert(newDb, "artifact", {
      id: safeId("artifact_orgplan", plan.id),
      mission_id: missionOrg.missionId,
      mission_run_id: missionOrg.missionRunId,
      work_item_id: null,
      council_session_id: null,
      file_asset_id: null,
      created_by_agent_id: null,
      artifact_type: "organization_plan",
      title: `Organization Plan v${plan.version ?? 1}`,
      version: plan.version ?? 1,
      status: plan.status ?? "compiled",
      content_text: "",
      content_json: asJson(plan.compiledJson, {}),
      evidence_json: JSON.stringify({ planHash: plan.planHash, policyHash: plan.policyHash, compilerIssues: parseJson(plan.compilerIssuesJson, []) }),
      created_at: toIso(plan.createdAt) ?? migratedAt,
      updated_at: toIso(plan.createdAt) ?? migratedAt
    }, { orIgnore: true });
  }

  for (const mission of missions) {
    event({
      workspaceId: workspaceForOrganization(mission.organizationId),
      missionId: mission.id,
      missionRunId: runByMission.get(mission.id)?.at(-1)?.id ?? null,
      sourceType: "migration",
      sourceId: mission.id,
      eventType: "database.migrated",
      actorType: "system",
      actorId: "migration:v0.9.0",
      message: "Mission data migrated from v0.8.0 to v0.9.0 canonical database",
      data: { from: "0.8.0", to: "0.9.0", migratedAt }
    });
  }

  return {
    workspaces: newDb.prepare("SELECT COUNT(*) AS count FROM workspace").get().count,
    missions: newDb.prepare("SELECT COUNT(*) AS count FROM mission").get().count,
    runs: newDb.prepare("SELECT COUNT(*) AS count FROM mission_run").get().count,
    workItems: newDb.prepare("SELECT COUNT(*) AS count FROM work_item").get().count,
    orgUnits: newDb.prepare("SELECT COUNT(*) AS count FROM org_unit").get().count,
    roles: newDb.prepare("SELECT COUNT(*) AS count FROM role").get().count,
    agents: newDb.prepare("SELECT COUNT(*) AS count FROM agent").get().count,
    reviews: newDb.prepare("SELECT COUNT(*) AS count FROM review").get().count,
    approvals: newDb.prepare("SELECT COUNT(*) AS count FROM approval").get().count,
    artifacts: newDb.prepare("SELECT COUNT(*) AS count FROM artifact").get().count,
    events: newDb.prepare("SELECT COUNT(*) AS count FROM event_log").get().count
  };
}

function validateNewDatabase(db) {
  const tables = listUserTables(db);
  const missing = CORE_TABLES.filter((table) => !tables.includes(table));
  const unexpected = tables.filter((table) => !CORE_TABLES.includes(table));
  if (missing.length > 0) throw new Error(`Missing v0.9.0 tables: ${missing.join(", ")}`);
  if (unexpected.length > 0) throw new Error(`Unexpected physical tables after rebuild: ${unexpected.join(", ")}`);
  const foreignKeyProblems = db.prepare("PRAGMA foreign_key_check").all();
  if (foreignKeyProblems.length > 0) throw new Error(`Foreign key validation failed: ${JSON.stringify(foreignKeyProblems.slice(0, 10))}`);
  const workspaces = Number(db.prepare("SELECT COUNT(*) AS count FROM workspace").get().count);
  if (workspaces < 1) throw new Error("The rebuilt database has no workspace");
  const versions = db.prepare("SELECT DISTINCT schema_version AS version FROM workspace").all().map((row) => row.version);
  if (versions.some((version) => version !== SCHEMA_VERSION)) throw new Error(`Unexpected schema version: ${versions.join(", ")}`);
  return { tableCount: tables.length, foreignKeyProblems: 0, workspaces, schemaVersion: SCHEMA_VERSION };
}

const path = databasePath();
const dryRun = args.has("--dry-run");
const force = args.has("--force");
const backupRoot = resolve(valueAfter("--backup-dir") ?? join(dirname(path), "..", "backups"));
mkdirSync(dirname(path), { recursive: true });
mkdirSync(backupRoot, { recursive: true });

if (!existsSync(path)) {
  if (dryRun) {
    console.log(JSON.stringify({ action: "create", database: path, schemaVersion: SCHEMA_VERSION, tableCount: CORE_TABLES.length }, null, 2));
    process.exit(0);
  }
  const db = new DatabaseSync(path);
  createV090Schema(db);
  const workspaceId = "local_workspace";
  insert(db, "workspace", {
    id: workspaceId,
    name: "AI Work Automation OS",
    slug: "ai-company",
    schema_version: SCHEMA_VERSION,
    mode: "local",
    owner_principal_id: "local:owner",
    settings_json: JSON.stringify({ installedAt: nowIso() }),
    created_at: nowIso(),
    updated_at: nowIso()
  });
  const validation = validateNewDatabase(db);
  db.close();
  console.log(JSON.stringify({ action: "created", database: path, ...validation }, null, 2));
  process.exit(0);
}

const source = new DatabaseSync(path);
const generation = detectSchemaGeneration(source);
source.close();

if (generation === "0.9.0" && !force) {
  const db = new DatabaseSync(path);
  const validation = validateNewDatabase(db);
  db.close();
  console.log(JSON.stringify({ action: "noop", reason: "already-v0.9.0", database: path, ...validation }, null, 2));
  process.exit(0);
}
if (generation !== "0.8.0") {
  throw new Error(`Unsupported source schema: ${generation}. Restore a valid v0.8.0 backup before rebuilding.`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = join(backupRoot, `${basename(path)}.v0.8.0.${stamp}.db`);
const sidecarPath = `${path}.v0.8.0`;
const tempPath = `${path}.v0.9.0.tmp`;
const reportPath = join(backupRoot, `${basename(path)}.v0.9.0-migration.${stamp}.json`);

if (dryRun) {
  console.log(JSON.stringify({ action: "migrate", from: "0.8.0", to: "0.9.0", database: path, backupPath, sidecarPath, tempPath, targetTables: CORE_TABLES }, null, 2));
  process.exit(0);
}

rmSync(tempPath, { force: true });
copyFileSync(path, backupPath);
const oldDb = new DatabaseSync(path, { readOnly: true });
const newDb = new DatabaseSync(tempPath);
newDb.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;");
createV090Schema(newDb);

let counts;
try {
  newDb.exec("BEGIN IMMEDIATE");
  counts = migrateV080(oldDb, newDb);
  newDb.exec("COMMIT");
} catch (error) {
  try { newDb.exec("ROLLBACK"); } catch {}
  oldDb.close();
  newDb.close();
  rmSync(tempPath, { force: true });
  throw error;
}
oldDb.close();
const validation = validateNewDatabase(newDb);
newDb.exec("PRAGMA wal_checkpoint(TRUNCATE)");
newDb.close();

rmSync(sidecarPath, { force: true });
renameSync(path, sidecarPath);
try {
  renameSync(tempPath, path);
} catch (error) {
  renameSync(sidecarPath, path);
  throw error;
}

const sidecarDb = new DatabaseSync(sidecarPath, { readOnly: true });
const sourceTables = listUserTables(sidecarDb);
sidecarDb.close();
const report = {
  action: "migrated",
  from: "0.8.0",
  to: SCHEMA_VERSION,
  database: path,
  backupPath,
  rollbackSidecar: sidecarPath,
  migratedAt: nowIso(),
  sourceTables,
  targetTables: CORE_TABLES,
  counts,
  validation
};
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ ...report, reportPath }, null, 2));
