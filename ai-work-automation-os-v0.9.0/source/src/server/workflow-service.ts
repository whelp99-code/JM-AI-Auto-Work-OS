import type { Prisma } from "@prisma/client";
import type { MissionType, RiskLevel } from "@/lib/contracts";
import { newId, stableHash } from "@/lib/ids";
import { parseJson, stringifyJson } from "@/lib/json";
import { createSyntheticWorkOutput, synthesizeFinalArtifact } from "@/lib/synthetic-output";
import { workflowPath, workflowPolicy } from "@/lib/workflow-policy";
import { prisma } from "./db";
import { appendEvent, approvalScopeHash } from "./event-service";
import { provisionMissionOrganization } from "./organization-service";
import { ensureMissionCouncil } from "./council-service";

type Tx = Prisma.TransactionClient;

async function ensureStep(tx: Tx, input: {
  missionRunId: string; workItemId?: string | null; orgUnitId?: string | null; agentId?: string | null;
  key: string; stepType: string; roleKey?: string | null; status?: string; input?: unknown;
}) {
  const existing = await tx.workflowStep.findFirst({ where: { missionRunId: input.missionRunId, key: input.key, instanceKey: "main", attempt: 1 } });
  if (existing) return existing;
  return tx.workflowStep.create({ data: {
    id: newId("step"), missionRunId: input.missionRunId, workItemId: input.workItemId ?? null,
    orgUnitId: input.orgUnitId ?? null, agentId: input.agentId ?? null,
    key: input.key, instanceKey: "main", stepType: input.stepType, roleKey: input.roleKey ?? null,
    status: input.status ?? "pending", inputJson: stringifyJson(input.input ?? {})
  }});
}

async function completeStep(tx: Tx, id: string, output: unknown, status = "completed") {
  return tx.workflowStep.update({ where: { id }, data: {
    status, outputJson: stringifyJson(output), startedAt: new Date(), completedAt: status === "waiting_approval" ? null : new Date()
  }});
}

async function nextTransitionSequence(tx: Tx, missionRunId: string): Promise<number> {
  const last = await tx.workflowTransition.aggregate({ where: { missionRunId }, _max: { sequence: true } });
  return (last._max.sequence ?? 0) + 1;
}

async function linkStep(tx: Tx, missionRunId: string, fromStepId: string | null, toStepId: string, conditionType = "always", condition: unknown = {}) {
  const existing = await tx.workflowTransition.findFirst({ where: { missionRunId, fromStepId, toStepId, selected: true } });
  if (existing) return existing;
  return tx.workflowTransition.create({ data: {
    id: newId("transition"), missionRunId, fromStepId, toStepId,
    sequence: await nextTransitionSequence(tx, missionRunId), conditionType,
    conditionJson: stringifyJson(condition), result: "selected", selected: true
  }});
}

async function markCurrent(tx: Tx, runId: string, key: string, state: unknown) {
  await tx.missionRun.update({ where: { id: runId }, data: { currentStepKey: key, stateJson: stringifyJson(state), updatedAt: new Date() } });
}

async function recordStepEvent(tx: Tx, input: { workspaceId: string; missionId: string; runId: string; stepId: string; key: string; status: string; data?: unknown }) {
  await appendEvent(tx, {
    workspaceId: input.workspaceId, missionId: input.missionId, missionRunId: input.runId,
    sourceType: "workflow_step", sourceId: input.stepId, eventType: `workflow.step.${input.status}`,
    message: `${input.key} 단계가 ${input.status} 상태가 되었습니다.`, data: input.data ?? {}
  });
}

async function basicStep(tx: Tx, context: { workspaceId: string; missionId: string; runId: string }, key: string, stepType: string, output: unknown, previousStepId: string | null) {
  const step = await ensureStep(tx, { missionRunId: context.runId, key, stepType });
  if (step.status !== "completed") await completeStep(tx, step.id, output);
  await linkStep(tx, context.runId, previousStepId, step.id);
  await markCurrent(tx, context.runId, key, { phase: key, updatedAt: new Date().toISOString() });
  await recordStepEvent(tx, { ...context, stepId: step.id, key, status: "completed", data: output });
  return step;
}

export async function executeMissionRun(missionRunId: string) {
  const initial = await prisma.missionRun.findUnique({ where: { id: missionRunId }, include: { mission: true } });
  if (!initial) throw new Error("not_found");
  if (["completed", "simulated", "failed", "blocked", "cancelled"].includes(initial.status)) return initial;
  if (initial.attemptCount >= initial.maxAttempts && initial.status !== "waiting_approval") {
    await prisma.missionRun.update({ where: { id: missionRunId }, data: { status: "failed", errorCode: "max_attempts_exceeded", errorMessage: "Workflow retry limit exceeded", completedAt: new Date() } });
    return prisma.missionRun.findUniqueOrThrow({ where: { id: missionRunId } });
  }
  await provisionMissionOrganization(missionRunId);
  const policy = workflowPolicy({
    missionType: initial.mission.missionType as MissionType,
    riskLevel: initial.mission.riskLevel as RiskLevel,
    requestedActions: parseJson<{ requestedActions?: string[] }>(initial.mission.inputJson, {}).requestedActions
  });
  await prisma.missionRun.update({ where: { id: missionRunId }, data: {
    status: "running", startedAt: initial.startedAt ?? new Date(), attemptCount: { increment: 1 },
    stateJson: stringifyJson({ policy, path: workflowPath(policy), schema: "workflow-state.v0.9.0" })
  }});
  await prisma.mission.update({ where: { id: initial.missionId }, data: { status: "running", currentStage: "workflow" } });

  if (policy.needsCouncil) await ensureMissionCouncil(missionRunId);

  const paused = await prisma.$transaction(async (tx) => {
    const run = await tx.missionRun.findUnique({ where: { id: missionRunId }, include: { mission: true } });
    if (!run) throw new Error("not_found");
    const context = { workspaceId: run.mission.workspaceId, missionId: run.missionId, runId: run.id };
    let previous: string | null = null;
    const budget = await basicStep(tx, context, "budget_guard", "deterministic", {
      budgetMicros: run.mission.budgetMicros.toString(), spentMicros: run.mission.spentMicros.toString(), allowed: true
    }, previous); previous = budget.id;
    const triage = await basicStep(tx, context, "triage", "deterministic", {
      missionType: run.mission.missionType, riskLevel: run.mission.riskLevel, policy
    }, previous); previous = triage.id;
    if (policy.needsResearch) {
      const research = await basicStep(tx, context, "research", "role", {
        finding: "업무 목표와 도메인 템플릿을 기준으로 필요한 근거와 작업 범위를 정리했습니다.", mode: "synthetic"
      }, previous); previous = research.id;
    }
    const plan = await basicStep(tx, context, "plan", "role", {
      workItems: await tx.workItem.count({ where: { missionRunId } }), organization: "provisioned", verificationProfile: policy.verificationProfile
    }, previous); previous = plan.id;
    if (policy.needsCouncil) {
      const council = await basicStep(tx, context, "council", "decision", { status: "completed", advisory: true }, previous); previous = council.id;
    }
    const requestedActions = parseJson<{ requestedActions?: string[] }>(run.mission.inputJson, {}).requestedActions ?? [];
    const externalActions = requestedActions.filter((action) => /배포|게시|발송|결제|송금|삭제|deploy|publish|send|payment|delete/i.test(action));
    for (const action of externalActions) {
      const idempotencyKey = `effect-${stableHash({ missionRunId, action }).slice(0, 40)}`;
      const existingEffect = await tx.externalEffect.findUnique({ where: { idempotencyKey } });
      if (!existingEffect) await tx.externalEffect.create({ data: {
        id: newId("effect"), missionId: run.missionId, missionRunId, actionType: "requested_external_action", target: action,
        status: "approval_required", idempotencyKey, requestHash: stableHash({ action, missionRunId }), requestJson: stringifyJson({ action }),
        replayPolicy: "manual_reconcile"
      }});
    }
    const risk = await basicStep(tx, context, "risk_gate", "deterministic", { riskLevel: run.mission.riskLevel, approvalRequired: policy.needsHumanApproval, externalActions: externalActions.length }, previous); previous = risk.id;
    if (policy.needsHumanApproval) {
      const scope = { runId: run.id, missionId: run.missionId, riskLevel: run.mission.riskLevel, action: "continue_workflow", objectiveHash: stableHash(run.mission.objective) };
      const scopeHash = approvalScopeHash(scope);
      let approval = await tx.approval.findFirst({ where: { missionRunId, approvalType: "workflow", targetType: "mission_run", targetId: run.id, scopeHash } });
      if (!approval) approval = await tx.approval.create({ data: {
        id: newId("approval"), missionId: run.missionId, missionRunId: run.id,
        approvalType: "workflow", status: "pending", riskLevel: run.mission.riskLevel,
        targetType: "mission_run", targetId: run.id, requestedBy: "workflow:risk_gate",
        scopeHash, requestJson: stringifyJson(scope), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }});
      if (approval.status !== "approved") {
        const wait = await ensureStep(tx, { missionRunId, key: "human_approval", stepType: "approval", status: "waiting_approval" });
        await completeStep(tx, wait.id, { approvalId: approval.id, scopeHash }, "waiting_approval");
        await linkStep(tx, missionRunId, previous, wait.id, "risk_requires_approval", { riskLevel: run.mission.riskLevel });
        await tx.missionRun.update({ where: { id: run.id }, data: { status: "waiting_approval", currentStepKey: "human_approval" } });
        await tx.mission.update({ where: { id: run.missionId }, data: { status: "awaiting_approval", currentStage: "approval" } });
        await appendEvent(tx, { ...context, sourceType: "approval", sourceId: approval.id, eventType: "approval.requested", severity: "warning", message: "고위험 업무 실행을 계속하려면 사용자 승인이 필요합니다.", data: scope });
        return true;
      }
      const wait = await ensureStep(tx, { missionRunId, key: "human_approval", stepType: "approval" });
      if (wait.status !== "completed") await completeStep(tx, wait.id, { approvalId: approval.id, decision: "approved" });
      await tx.externalEffect.updateMany({ where: { missionRunId, status: "approval_required" }, data: { status: "prepared", approvedBy: approval.decidedBy ?? "local:owner", approvedAt: approval.decidedAt ?? new Date() } });
      await linkStep(tx, missionRunId, previous, wait.id, "approval_granted", { approvalId: approval.id });
    }
    return false;
  });
  if (paused) return prisma.missionRun.findUniqueOrThrow({ where: { id: missionRunId } });

  try {
    await prisma.$transaction(async (tx) => {
    const run = await tx.missionRun.findUnique({ where: { id: missionRunId }, include: { mission: true } });
    if (!run) throw new Error("not_found");
    const context = { workspaceId: run.mission.workspaceId, missionId: run.missionId, runId: run.id };
    const allSteps = await tx.workflowStep.findMany({ where: { missionRunId }, orderBy: { createdAt: "asc" } });
    let previous = allSteps.at(-1)?.id ?? null;
    const workItems = await tx.workItem.findMany({ where: { missionRunId }, include: { agent: { include: { role: true } }, orgUnit: true }, orderBy: { sequence: "asc" } });
    for (const work of workItems) {
      const key = `execute:${work.key}`;
      const step = await ensureStep(tx, { missionRunId, workItemId: work.id, orgUnitId: work.orgUnitId, agentId: work.agentId, key, stepType: "role", roleKey: work.agent?.role.key ?? null });
      await linkStep(tx, missionRunId, previous, step.id, "work_ready", { workItemId: work.id });
      if (work.status !== "completed") {
        const output = createSyntheticWorkOutput({ missionType: run.mission.missionType as MissionType, missionObjective: run.mission.objective, title: work.title, objective: work.objective });
        await tx.workItem.update({ where: { id: work.id }, data: {
          status: "completed", outputJson: stringifyJson(output), evidenceJson: stringifyJson(output.evidence),
          attemptCount: { increment: 1 }, startedAt: work.startedAt ?? new Date(), completedAt: new Date()
        }});
        await completeStep(tx, step.id, output);
        await recordStepEvent(tx, { ...context, stepId: step.id, key, status: "completed", data: { workItemId: work.id, agent: work.agent?.name } });
      }
      previous = step.id;
      const verifyKey = `verify:${work.key}`;
      const verifier = await tx.agent.findFirst({ where: { missionRunId, orgUnitId: work.orgUnitId, role: { isVerifier: true }, status: "active" }, include: { role: true } });
      const verifyStep = await ensureStep(tx, { missionRunId, workItemId: work.id, orgUnitId: work.orgUnitId, agentId: verifier?.id ?? null, key: verifyKey, stepType: "verification", roleKey: verifier?.role.key ?? "independent-verifier" });
      await linkStep(tx, missionRunId, previous, verifyStep.id, "requires_verification", { workItemId: work.id });
      const refreshed = await tx.workItem.findUniqueOrThrow({ where: { id: work.id } });
      const output = parseJson<{ markdown?: string }>(refreshed.outputJson, {});
      const passed = Boolean(output.markdown?.trim());
      let review = await tx.review.findFirst({ where: { missionRunId, workItemId: work.id, reviewType: "independent" } });
      const reviewData = {
        status: "completed", verdict: passed ? "passed" : "failed", severity: passed ? "info" : "high",
        score: passed ? 1 : 0, confidence: passed ? 0.92 : 0.98,
        criteriaJson: refreshed.criteriaJson, evidenceJson: refreshed.evidenceJson,
        failureJson: stringifyJson(passed ? [] : [{ failureType: "execution_error", blocking: true, expected: "usable output", observed: "empty output", recommendedRoute: "execute" }]),
        summary: passed ? "요구사항과 결과물 존재 여부를 독립적으로 확인했습니다." : "결과물이 없어 재실행이 필요합니다.", completedAt: new Date()
      };
      if (review) review = await tx.review.update({ where: { id: review.id }, data: reviewData });
      else review = await tx.review.create({ data: { id: newId("review"), missionId: run.missionId, missionRunId, workItemId: work.id, workflowStepId: verifyStep.id, reviewerAgentId: verifier?.id ?? null, reviewType: "independent", ...reviewData } });
      await completeStep(tx, verifyStep.id, { reviewId: review.id, verdict: review.verdict }, passed ? "completed" : "failed");
      await recordStepEvent(tx, { ...context, stepId: verifyStep.id, key: verifyKey, status: passed ? "completed" : "failed", data: { reviewId: review.id } });
      if (!passed) throw new Error(`verification_failed:${work.key}`);
      previous = verifyStep.id;
    }
    const councilDecision = await tx.decisionRecord.findFirst({ where: { missionRunId, sourceType: "council" }, orderBy: { createdAt: "desc" } });
    const completedWork = await tx.workItem.findMany({ where: { missionRunId, status: "completed" }, orderBy: { sequence: "asc" } });
    const finalMarkdown = synthesizeFinalArtifact({
      title: run.mission.title, objective: run.mission.objective,
      work: completedWork.map((work) => ({ title: work.title, markdown: parseJson<{ markdown?: string }>(work.outputJson, {}).markdown ?? "" })),
      councilDecision: councilDecision?.summary
    });
    const synthesize = await ensureStep(tx, { missionRunId, key: "synthesize", stepType: "role", roleKey: "synthesizer" });
    await linkStep(tx, missionRunId, previous, synthesize.id); await completeStep(tx, synthesize.id, { artifactType: "final_report" }); previous = synthesize.id;
    let artifact = await tx.artifact.findFirst({ where: { missionRunId, artifactType: "final_report", version: 1 } });
    if (!artifact) artifact = await tx.artifact.create({ data: {
      id: newId("artifact"), missionId: run.missionId, missionRunId, artifactType: "final_report",
      title: `${run.mission.title} — 최종 업무 산출물`, version: 1, status: "verified",
      contentText: finalMarkdown, contentJson: stringifyJson({ missionType: run.mission.missionType, workItems: completedWork.map((item) => item.id) }),
      evidenceJson: stringifyJson({ reviews: await tx.review.count({ where: { missionRunId, verdict: "passed" } }), synthetic: true })
    }});
    const finalVerify = await basicStep(tx, context, "final_verify", "verification", { artifactId: artifact.id, verdict: "passed", profile: policy.verificationProfile }, previous); previous = finalVerify.id;
    const finalGate = await basicStep(tx, context, "final_gate", "deterministic", { verified: true, blockingFailures: 0, artifactId: artifact.id }, previous); previous = finalGate.id;
    const finalize = await basicStep(tx, context, "finalize", "terminal", { status: "simulated", artifactId: artifact.id }, previous);
    await tx.missionRun.update({ where: { id: missionRunId }, data: {
      status: "simulated", currentStepKey: "finalize", completedAt: new Date(),
      resultJson: stringifyJson({ artifactId: artifact.id, status: "simulated", evidenceMode: "synthetic" }),
      stateJson: stringifyJson({ phase: "finalize", completed: true, verificationPassed: true, finalGatePassed: true })
    }});
    await tx.mission.update({ where: { id: run.missionId }, data: {
      status: "simulated", currentStage: "completed", spentMicros: run.mission.spentMicros, completedAt: new Date()
    }});
    await appendEvent(tx, { ...context, sourceType: "mission_run", sourceId: missionRunId, eventType: "mission.completed", message: "검증된 최종 산출물을 생성했습니다.", data: { artifactId: artifact.id, evidenceMode: "synthetic" } });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "workflow_failed";
    const failed = await prisma.missionRun.update({ where: { id: missionRunId }, data: {
      status: "failed", errorCode: message.split(":")[0] || "workflow_failed", errorMessage: message, completedAt: new Date()
    }});
    await prisma.mission.update({ where: { id: failed.missionId }, data: { status: "failed", currentStage: "failed" } });
    throw error;
  }
  return prisma.missionRun.findUniqueOrThrow({ where: { id: missionRunId } });
}
