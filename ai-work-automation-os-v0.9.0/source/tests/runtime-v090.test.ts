import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/server/db";
import { createMission, createMissionRun } from "../src/server/mission-service";
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
