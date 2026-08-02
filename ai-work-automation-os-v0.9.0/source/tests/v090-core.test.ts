import test from "node:test";
import assert from "node:assert/strict";
import { inferMissionType, inferRiskLevel, normalizeMissionInput } from "../src/lib/contracts";
import { organizationTemplateFor } from "../src/lib/templates";
import { workflowPath, workflowPolicy } from "../src/lib/workflow-policy";
import { PRODUCT, RUNTIME_BOUNDARIES } from "../src/lib/product";

test("product definition remains AI Work Automation OS and separates ProofGraph", () => {
  assert.equal(PRODUCT.version, "0.9.0"); assert.equal(PRODUCT.tableCount, 18);
  assert.match(PRODUCT.definition, /업무 자동화/); assert.match(RUNTIME_BOUNDARIES.proofGraph, /별도/);
});

test("mission type and risk are inferred from business objective", () => {
  assert.equal(inferMissionType("운영 대시보드 UI 디자인"), "design");
  assert.equal(inferMissionType("SEO 캠페인 계획"), "marketing");
  assert.equal(inferRiskLevel({ objective: "production에 배포", requestedActions: ["외부 게시"] }), "RED");
});

test("organization templates always separate producer and verifier", () => {
  for (const type of ["general","research","design","marketing","development","operations","finance","customer_support"] as const) {
    const template = organizationTemplateFor(type);
    for (const department of template.departments) for (const team of department.teams) {
      assert.ok(team.roles.some((role) => role.isLead));
      assert.ok(team.roles.some((role) => role.isVerifier));
      assert.ok(team.roles.some((role) => !role.isVerifier && !role.isLead));
    }
  }
});

test("RED route inserts human approval and never skips verification", () => {
  const policy = workflowPolicy({ missionType: "development", riskLevel: "RED" });
  const path = workflowPath(policy);
  assert.ok(path.includes("human_approval")); assert.ok(path.includes("verify")); assert.ok(path.includes("final_verify")); assert.ok(path.indexOf("final_verify") < path.indexOf("finalize"));
});

test("mission normalization bounds budget and cleans criteria", () => {
  const normalized = normalizeMissionInput({ objective: "업무 프로세스 자동화", budgetUsd: 5, successCriteria: ["", "완료"] });
  assert.equal(normalized.missionType, "operations"); assert.deepEqual(normalized.successCriteria, ["완료"]);
  assert.throws(() => normalizeMissionInput({ objective: "x", budgetUsd: 10001 }));
});
