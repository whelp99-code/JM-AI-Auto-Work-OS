import type { Prisma } from "@prisma/client";
import { organizationTemplateFor } from "@/lib/templates";
import type { MissionType, RoleTemplate } from "@/lib/contracts";
import { newId, safeKey } from "@/lib/ids";
import { stringifyJson } from "@/lib/json";
import { prisma } from "./db";
import { appendEvent } from "./event-service";

async function ensureUnit(tx: Prisma.TransactionClient, input: {
  workspaceId: string; missionRunId: string; parentId?: string | null; unitType: string; key: string; name: string; objective: string; budgetMicros?: bigint; settings?: unknown;
}) {
  const existing = await tx.orgUnit.findFirst({ where: { workspaceId: input.workspaceId, missionRunId: input.missionRunId, key: input.key } });
  if (existing) return existing;
  return tx.orgUnit.create({ data: {
    id: newId("unit"), workspaceId: input.workspaceId, missionRunId: input.missionRunId,
    parentId: input.parentId ?? null, unitType: input.unitType, key: input.key,
    name: input.name, objective: input.objective, budgetMicros: input.budgetMicros ?? 0n,
    settingsJson: stringifyJson(input.settings ?? {})
  }});
}

async function ensureRole(tx: Prisma.TransactionClient, workspaceId: string, orgUnitId: string, role: RoleTemplate) {
  const existing = await tx.role.findFirst({ where: { workspaceId, orgUnitId, key: role.key } });
  if (existing) return existing;
  return tx.role.create({ data: {
    id: newId("role"), workspaceId, orgUnitId, key: role.key, title: role.title,
    category: role.category, capabilitiesJson: stringifyJson(role.capabilities),
    responsibilitiesJson: stringifyJson([`${role.title} 책임 수행`, "작업 결과와 근거 기록"]),
    permissionsJson: stringifyJson(role.permissions),
    toolPolicyJson: stringifyJson({ mode: role.isVerifier ? "read_only" : "controlled", externalEffects: false }),
    modelClass: role.isVerifier ? "deep" : "balanced", isLead: Boolean(role.isLead), isVerifier: Boolean(role.isVerifier)
  }});
}

async function ensureAgent(tx: Prisma.TransactionClient, input: {
  workspaceId: string; missionRunId: string; orgUnitId: string; roleId: string; name: string; managerAgentId?: string | null; capabilities: string[]; permissions: string[]; temporary?: boolean;
}) {
  const existing = await tx.agent.findFirst({ where: { missionRunId: input.missionRunId, roleId: input.roleId, name: input.name } });
  if (existing) return existing;
  return tx.agent.create({ data: {
    id: newId("agent"), workspaceId: input.workspaceId, missionRunId: input.missionRunId,
    orgUnitId: input.orgUnitId, roleId: input.roleId, managerAgentId: input.managerAgentId ?? null,
    name: input.name, status: "active", capabilitiesJson: stringifyJson(input.capabilities),
    permissionsJson: stringifyJson(input.permissions), contextJson: "{}", temporary: input.temporary ?? true,
    activatedAt: new Date()
  }});
}

export async function provisionMissionOrganization(missionRunId: string) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.missionRun.findUnique({ where: { id: missionRunId }, include: { mission: true } });
    if (!run) throw new Error("not_found");
    const workspaceId = run.mission.workspaceId;
    const template = organizationTemplateFor(run.mission.missionType as MissionType);
    const root = await ensureUnit(tx, {
      workspaceId, missionRunId, unitType: "mission_organization", key: "mission-organization",
      name: `${run.mission.title} 실행 조직`, objective: run.mission.objective,
      budgetMicros: run.mission.budgetMicros,
      settings: { missionType: template.missionType, schema: "organization.v0.9.0", temporary: true }
    });
    const ceoRole = await ensureRole(tx, workspaceId, root.id, {
      key: "executive-manager", title: "Executive Manager", category: "manager",
      capabilities: ["goal-analysis", "organization-design", "budget-control", "decision-making"],
      permissions: ["work:assign", "team:request", "agent:request", "approval:request", "artifact:read"], isLead: true
    });
    const ceo = await ensureAgent(tx, {
      workspaceId, missionRunId, orgUnitId: root.id, roleId: ceoRole.id, name: "Executive Manager",
      capabilities: ["goal-analysis", "organization-design", "decision-making"],
      permissions: ["work:assign", "team:request", "agent:request", "approval:request", "artifact:read"]
    });
    const roleAgentMap = new Map<string, { roleId: string; agentId: string; unitId: string }>();
    for (const department of template.departments) {
      const departmentUnit = await ensureUnit(tx, {
        workspaceId, missionRunId, parentId: root.id, unitType: "department", key: `department:${department.key}`,
        name: department.name, objective: department.objective,
        settings: { templateKey: department.key }
      });
      const directorRole = await ensureRole(tx, workspaceId, departmentUnit.id, {
        key: `${department.key}-director`, title: `${department.name} 책임자`, category: "manager",
        capabilities: ["planning", "delegation", "quality-control"],
        permissions: ["work:assign", "agent:request", "artifact:read", "artifact:write"], isLead: true
      });
      const director = await ensureAgent(tx, {
        workspaceId, missionRunId, orgUnitId: departmentUnit.id, roleId: directorRole.id,
        name: `${department.name} 책임자`, managerAgentId: ceo.id,
        capabilities: ["planning", "delegation", "quality-control"],
        permissions: ["work:assign", "agent:request", "artifact:read", "artifact:write"]
      });
      for (const team of department.teams) {
        const teamUnit = await ensureUnit(tx, {
          workspaceId, missionRunId, parentId: departmentUnit.id, unitType: "team",
          key: `team:${department.key}:${team.key}`, name: team.name, objective: team.objective,
          settings: { capabilities: team.capabilities, templateKey: team.key }
        });
        let leadAgentId: string | null = null;
        const sortedRoles = [...team.roles].sort((a, b) => Number(Boolean(b.isLead)) - Number(Boolean(a.isLead)));
        for (const roleTemplate of sortedRoles) {
          const role = await ensureRole(tx, workspaceId, teamUnit.id, roleTemplate);
          const managerAgentId = roleTemplate.isLead ? director.id : leadAgentId ?? director.id;
          const agent = await ensureAgent(tx, {
            workspaceId, missionRunId, orgUnitId: teamUnit.id, roleId: role.id,
            name: roleTemplate.title, managerAgentId,
            capabilities: roleTemplate.capabilities, permissions: roleTemplate.permissions
          });
          if (roleTemplate.isLead) leadAgentId = agent.id;
          roleAgentMap.set(roleTemplate.key, { roleId: role.id, agentId: agent.id, unitId: teamUnit.id });
        }
      }
    }
    let sequence = 1;
    for (const work of template.workItems) {
      const assignee = roleAgentMap.get(work.roleKey);
      const existing = await tx.workItem.findFirst({ where: { missionRunId, key: work.key } });
      if (!existing) await tx.workItem.create({ data: {
        id: newId("work"), missionId: run.missionId, missionRunId,
        orgUnitId: assignee?.unitId ?? root.id, agentId: assignee?.agentId ?? ceo.id,
        key: work.key, sequence, title: work.title, objective: work.objective,
        workType: work.workType, status: "pending", riskLevel: run.mission.riskLevel,
        inputJson: stringifyJson({ objective: run.mission.objective }), criteriaJson: stringifyJson(work.criteria)
      }});
      sequence += 1;
    }
    await appendEvent(tx, {
      workspaceId, missionId: run.missionId, missionRunId, sourceType: "organization", sourceId: root.id,
      eventType: "organization.provisioned", actorType: "runtime", actorId: ceo.id,
      message: `${template.departments.length}개 부서와 전문 역할로 미션 조직을 구성했습니다.`,
      data: { missionType: template.missionType, departments: template.departments.length, workItems: template.workItems.length }
    });
    return root;
  });
}

export async function organizationView(missionRunId: string) {
  const units = await prisma.orgUnit.findMany({ where: { missionRunId }, orderBy: [{ unitType: "asc" }, { createdAt: "asc" }] });
  const roles = await prisma.role.findMany({ where: { orgUnit: { missionRunId } }, orderBy: { createdAt: "asc" } });
  const agents = await prisma.agent.findMany({ where: { missionRunId }, orderBy: { createdAt: "asc" } });
  return { units, roles, agents };
}
