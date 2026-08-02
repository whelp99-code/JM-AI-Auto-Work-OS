import { normalizeMissionInput, type MissionInput } from "@/lib/contracts";
import { newId, stableHash } from "@/lib/ids";
import { stringifyJson } from "@/lib/json";
import { prisma } from "./db";
import { ensureLocalWorkspace } from "./database-service";
import { appendEvent } from "./event-service";
import { executeMissionRun } from "./workflow-service";

export async function createMission(input: MissionInput) {
  const normalized = normalizeMissionInput(input);
  const workspace = await ensureLocalWorkspace();
  return prisma.$transaction(async (tx) => {
    const mission = await tx.mission.create({ data: {
      id: newId("mission"), workspaceId: workspace.id, title: normalized.title,
      objective: normalized.objective, missionType: normalized.missionType,
      status: "ready", priority: normalized.priority, riskLevel: normalized.riskLevel,
      budgetMicros: BigInt(Math.round(normalized.budgetUsd * 1_000_000)),
      successJson: stringifyJson(normalized.successCriteria), constraintsJson: stringifyJson(normalized.constraints),
      inputJson: stringifyJson({ requestedActions: normalized.requestedActions }), currentStage: "ready"
    }});
    await appendEvent(tx, {
      workspaceId: workspace.id, missionId: mission.id, sourceType: "mission", sourceId: mission.id,
      eventType: "mission.created", actorType: "user", actorId: workspace.ownerPrincipalId,
      message: "새 업무 목표를 등록했습니다.", data: { missionType: mission.missionType, riskLevel: mission.riskLevel }
    });
    return mission;
  });
}

export async function createMissionRun(missionId: string, idempotencyKey?: string) {
  const mission = await prisma.mission.findUnique({ where: { id: missionId } });
  if (!mission) throw new Error("not_found");
  const key = (idempotencyKey?.trim() || `local-${stableHash({ missionId, objective: mission.objective }).slice(0, 24)}`).slice(0, 120);
  const existing = await prisma.missionRun.findUnique({ where: { missionId_idempotencyKey: { missionId, idempotencyKey: key } } });
  if (existing) return existing;
  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.missionRun.create({ data: {
      id: newId("run"), missionId, idempotencyKey: key,
      requestedBy: "local:owner", status: "queued", runtimeMode: "inline",
      stateJson: stringifyJson({ schema: "workflow-state.v0.9.0", phase: "queued" }),
      budgetJson: stringifyJson({ hardLimitMicros: mission.budgetMicros.toString(), callsLimit: 30, tokensLimit: 100000 })
    }});
    await appendEvent(tx, {
      workspaceId: mission.workspaceId, missionId, missionRunId: created.id,
      sourceType: "mission_run", sourceId: created.id, eventType: "mission_run.created",
      actorType: "user", actorId: "local:owner", message: "로컬 Inline 실행을 생성했습니다.", data: { idempotencyKey: key }
    });
    return created;
  });
  return executeMissionRun(run.id);
}

export async function listMissions() {
  const workspace = await ensureLocalWorkspace();
  return prisma.mission.findMany({
    where: { workspaceId: workspace.id }, orderBy: { updatedAt: "desc" },
    include: { runs: { orderBy: { createdAt: "desc" }, take: 1 }, _count: { select: { workItems: true, artifacts: true, approvals: true } } }
  });
}

export async function retryMissionRun(runId: string) {
  const run = await prisma.missionRun.findUnique({ where: { id: runId } });
  if (!run) throw new Error("not_found");
  if (["completed", "simulated"].includes(run.status)) return run;
  return executeMissionRun(run.id);
}
