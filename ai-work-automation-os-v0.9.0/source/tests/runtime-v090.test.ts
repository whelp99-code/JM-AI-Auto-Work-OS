import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/server/db";
import { createMission, createMissionRun, retryMissionRun } from "../src/server/mission-service";
import { executeMissionRun } from "../src/server/workflow-service";
import { listApprovals, resolveApproval } from "../src/server/approval-service";
import { ensureMissionCouncil } from "../src/server/council-service";
import { missionWorkspace } from "../src/server/workspace-service";

beforeEach(async () => {
  await prisma.$transaction([
    prisma.eventLog.deleteMany(),
    prisma.externalEffect.deleteMany(),
    prisma.artifact.deleteMany(),
    prisma.decisionRecord.deleteMany(),
    prisma.councilMessage.deleteMany(),
    prisma.councilSession.deleteMany(),
    prisma.approval.deleteMany(),
    prisma.review.deleteMany(),
    prisma.workflowTransition.deleteMany(),
    prisma.workflowStep.deleteMany(),
    prisma.workItem.deleteMany(),
    prisma.agent.deleteMany(),
    prisma.role.deleteMany(),
    prisma.orgUnit.deleteMany(),
    prisma.missionRun.deleteMany(),
    prisma.mission.deleteMany(),
    prisma.fileAsset.deleteMany(),
    prisma.workspace.deleteMany()
  ]);
});

after(async () => prisma.$disconnect());

async function createFailedRedRun(key: string) {
  const mission = await createMission({
    objective: "프로덕션에 배포한다",
    requestedActions: ["deploy production"]
  });
  const waiting = await createMissionRun(mission.id, key);
  assert.equal(waiting.status, "waiting_approval");
  const work = await prisma.workItem.findFirstOrThrow({ where: { missionRunId: waiting.id }, orderBy: { sequence: "asc" } });
  await prisma.workItem.update({ where: { id: work.id }, data: {
    status: "completed", outputJson: "{}", evidenceJson: "[]", completedAt: new Date()
  } });
  const approval = await prisma.approval.findFirstOrThrow({ where: { missionRunId: waiting.id, status: "pending" } });
  await assert.rejects(
    resolveApproval(approval.id, { decision: "approved", comment: "force verification fixture", scopeHash: approval.scopeHash }),
    /verification_failed/
  );
  return { mission, runId: waiting.id, workId: work.id };
}

test("GREEN design mission provisions organization, workflow, verification and artifact", async () => {
  const mission = await createMission({
    objective: "운영 대시보드 UX/UI를 설계한다",
    successCriteria: ["화면 상태 정의"]
  });
  const run = await createMissionRun(mission.id, "test-green");
  assert.equal(run.status, "simulated");

  const workspace = await missionWorkspace(run.id) as any;
  assert.equal(workspace.organization.units.filter((unit: any) => unit.unitType === "department").length, 1);
  assert.ok(workspace.organization.units.filter((unit: any) => unit.unitType === "team").length >= 2);
  assert.ok(workspace.organization.agents.length >= 6);
  assert.equal(workspace.overview.approvals.pending, 0);
  assert.ok(workspace.overview.artifacts >= 1);
  assert.equal(workspace.run.steps.find((step: any) => step.key === "final_gate")?.status, "completed");
  assert.ok(workspace.run.reviews.every((review: any) => review.verdict === "passed"));
});

test("RED mission pauses at approval and resumes without executing the external effect", async () => {
  const mission = await createMission({
    objective: "프로덕션에 배포한다",
    requestedActions: ["deploy production"]
  });
  const waiting = await createMissionRun(mission.id, "test-red");
  assert.equal(waiting.status, "waiting_approval");

  const approvals = await listApprovals("pending");
  assert.equal(approvals.length, 1);
  await resolveApproval(approvals[0].id, {
    decision: "approved",
    comment: "local owner approved",
    scopeHash: approvals[0].scopeHash
  });

  const workspace = await missionWorkspace(waiting.id) as any;
  assert.equal(workspace.run.status, "simulated");
  assert.equal(workspace.run.approvals[0].status, "approved");
  assert.equal(workspace.run.effects.length, 1);
  assert.equal(workspace.run.effects[0].status, "prepared");
  assert.equal(workspace.run.effects[0].executedAt, null);
});

test("approved waiting run resumes exactly once even at its attempt limit", async () => {
  const mission = await createMission({ objective: "프로덕션에 배포한다", requestedActions: ["deploy production"] });
  const waiting = await createMissionRun(mission.id, "test-approval-max-resume");
  assert.equal(waiting.status, "waiting_approval");
  await prisma.missionRun.update({ where: { id: waiting.id }, data: { maxAttempts: 1 } });
  const approval = await prisma.approval.findFirstOrThrow({ where: { missionRunId: waiting.id, status: "pending" } });
  const results = await Promise.allSettled([
    resolveApproval(approval.id, { decision: "approved", comment: "resume at limit", scopeHash: approval.scopeHash }),
    executeMissionRun(waiting.id)
  ]);
  assert.ok(results.some((result) => result.status === "fulfilled"));
  const completed = await prisma.missionRun.findUniqueOrThrow({ where: { id: waiting.id } });
  assert.equal(completed.status, "simulated");
  assert.equal(completed.attemptCount, 2);
  assert.equal(completed.maxAttempts, 1);
  assert.equal(await prisma.eventLog.count({ where: { missionRunId: waiting.id, eventType: "mission.completed" } }), 1);
});

test("Council remains a decision-support module and is idempotent", async () => {
  const mission = await createMission({
    objective: "시장 진입 전략을 비교한다",
    missionType: "marketing"
  });
  const run = await createMissionRun(mission.id, "test-council");
  const first = await ensureMissionCouncil(run.id);
  const second = await ensureMissionCouncil(run.id);
  assert.equal(first.id, second.id);

  const workspace = await missionWorkspace(run.id) as any;
  assert.equal(workspace.run.councils.length, 1);
  assert.equal(workspace.run.councils[0].messages.length, 3);
  assert.ok(workspace.run.decisions.some((decision: any) => decision.sourceType === "council"));
});

test("failed verification recovery persists review, step, event, and failed run after main rollback", async () => {
  const failed = await createFailedRedRun("test-failed-evidence");
  const review = await prisma.review.findFirstOrThrow({ where: { missionRunId: failed.runId, workItemId: failed.workId, reviewType: "independent" } });
  assert.equal(review.verdict, "failed");
  assert.notEqual(review.failureJson, "[]");
  const step = await prisma.workflowStep.findFirstOrThrow({ where: { missionRunId: failed.runId, key: { startsWith: "verify:" } } });
  assert.equal(step.status, "failed");
  const event = await prisma.eventLog.findFirst({ where: { missionRunId: failed.runId, eventType: "workflow.step.failed" } });
  assert.ok(event);
  const run = await prisma.missionRun.findUniqueOrThrow({ where: { id: failed.runId }, include: { mission: true } });
  assert.equal(run.status, "failed");
  assert.equal(run.mission.status, "failed");
  assert.equal(await prisma.review.count({ where: { missionRunId: failed.runId, workItemId: failed.workId, reviewType: "independent" } }), 1);
});

test("failed run retries once through CAS and resumes to simulated", async () => {
  const failed = await createFailedRedRun("test-retry-success");
  const before = await prisma.missionRun.findUniqueOrThrow({ where: { id: failed.runId } });
  await prisma.workItem.update({ where: { id: failed.workId }, data: { status: "pending", outputJson: null, evidenceJson: "[]", completedAt: null } });
  const retried = await retryMissionRun(failed.runId);
  assert.equal(retried.status, "simulated");
  assert.equal(retried.attemptCount, before.attemptCount + 1);
  const originalReview = await prisma.review.findFirstOrThrow({ where: { missionRunId: failed.runId, workItemId: failed.workId, reviewType: "independent" } });
  assert.equal(originalReview.verdict, "failed");
  assert.notEqual(originalReview.failureJson, "[]");
  const originalStep = await prisma.workflowStep.findFirstOrThrow({ where: { missionRunId: failed.runId, workItemId: failed.workId, key: { startsWith: "verify:" }, attempt: before.attemptCount } });
  assert.equal(originalStep.status, "failed");
  assert.equal(await prisma.review.count({ where: { missionRunId: failed.runId, workItemId: failed.workId, reviewType: `independent:attempt-${retried.attemptCount}`, verdict: "passed" } }), 1);
  assert.equal(await prisma.workflowStep.count({ where: { missionRunId: failed.runId, workItemId: failed.workId, key: { startsWith: "verify:" }, attempt: retried.attemptCount, status: "completed" } }), 1);
});

test("direct execution rejects a failed run without changing its attempt count", async () => {
  const failed = await createFailedRedRun("test-direct-failed-rejected");
  const before = await prisma.missionRun.findUniqueOrThrow({ where: { id: failed.runId } });
  await assert.rejects(executeMissionRun(failed.runId), /invalid_run_state:failed/);
  const after = await prisma.missionRun.findUniqueOrThrow({ where: { id: failed.runId } });
  assert.equal(after.status, "failed");
  assert.equal(after.attemptCount, before.attemptCount);
});

test("retry rejects maxed, blocked, and waiting approval states without increasing attempts", async () => {
  const failed = await createFailedRedRun("test-retry-reject");
  const before = await prisma.missionRun.findUniqueOrThrow({ where: { id: failed.runId } });
  await prisma.missionRun.update({ where: { id: failed.runId }, data: { maxAttempts: before.attemptCount } });
  await assert.rejects(retryMissionRun(failed.runId), /max_attempts_exceeded/);
  assert.equal((await prisma.missionRun.findUniqueOrThrow({ where: { id: failed.runId } })).attemptCount, before.attemptCount);
  await prisma.missionRun.update({ where: { id: failed.runId }, data: { status: "blocked" } });
  await assert.rejects(retryMissionRun(failed.runId), /invalid_run_state:blocked/);
  assert.equal((await prisma.missionRun.findUniqueOrThrow({ where: { id: failed.runId } })).attemptCount, before.attemptCount);

  const waitingMission = await createMission({ objective: "프로덕션에 배포한다", requestedActions: ["deploy production"] });
  const waiting = await createMissionRun(waitingMission.id, "test-retry-waiting");
  const waitingBefore = waiting.attemptCount;
  await assert.rejects(retryMissionRun(waiting.id), /invalid_run_state:waiting_approval/);
  assert.equal((await prisma.missionRun.findUniqueOrThrow({ where: { id: waiting.id } })).attemptCount, waitingBefore);
});

test("concurrent failed retries have one execution winner", async () => {
  const failed = await createFailedRedRun("test-retry-concurrent");
  const before = await prisma.missionRun.findUniqueOrThrow({ where: { id: failed.runId } });
  await prisma.workItem.update({ where: { id: failed.workId }, data: { status: "pending", outputJson: null, evidenceJson: "[]", completedAt: null } });
  const results = await Promise.allSettled([retryMissionRun(failed.runId), retryMissionRun(failed.runId)]);
  assert.ok(results.some((result) => result.status === "fulfilled"));
  for (const result of results) {
    if (result.status === "rejected") assert.match(String(result.reason), /retry_conflict/);
  }
  const completed = await prisma.missionRun.findUniqueOrThrow({ where: { id: failed.runId } });
  assert.equal(completed.status, "simulated");
  assert.equal(completed.attemptCount, before.attemptCount + 1);
  const originalReview = await prisma.review.findFirstOrThrow({ where: { missionRunId: failed.runId, workItemId: failed.workId, reviewType: "independent" } });
  assert.equal(originalReview.verdict, "failed");
  assert.notEqual(originalReview.failureJson, "[]");
  const originalStep = await prisma.workflowStep.findFirstOrThrow({ where: { missionRunId: failed.runId, workItemId: failed.workId, key: { startsWith: "verify:" }, attempt: before.attemptCount } });
  assert.equal(originalStep.status, "failed");
  assert.equal(await prisma.review.count({ where: { missionRunId: failed.runId, workItemId: failed.workId, reviewType: `independent:attempt-${completed.attemptCount}`, verdict: "passed" } }), 1);
  assert.equal(await prisma.workflowStep.count({ where: { missionRunId: failed.runId, workItemId: failed.workId, key: { startsWith: "verify:" }, attempt: completed.attemptCount, status: "completed" } }), 1);
  const events = await prisma.eventLog.findMany({ where: { missionRunId: failed.runId }, select: { eventType: true } });
  assert.equal(events.filter((event) => event.eventType === "mission.completed").length, 1, JSON.stringify(events));
});

test("concurrent direct execute and retry have one bounded execution winner", async () => {
  const failed = await createFailedRedRun("test-direct-retry-concurrent");
  const before = await prisma.missionRun.findUniqueOrThrow({ where: { id: failed.runId } });
  await prisma.workItem.update({ where: { id: failed.workId }, data: { status: "pending", outputJson: null, evidenceJson: "[]", completedAt: null } });
  const results = await Promise.allSettled([executeMissionRun(failed.runId), retryMissionRun(failed.runId)]);
  assert.ok(results.some((result) => result.status === "fulfilled"));
  const completed = await prisma.missionRun.findUniqueOrThrow({ where: { id: failed.runId } });
  assert.equal(completed.status, "simulated");
  assert.equal(completed.attemptCount, before.attemptCount + 1);
  assert.ok(completed.attemptCount <= completed.maxAttempts);
  assert.equal(await prisma.eventLog.count({ where: { missionRunId: failed.runId, eventType: "mission.completed" } }), 1);
});
