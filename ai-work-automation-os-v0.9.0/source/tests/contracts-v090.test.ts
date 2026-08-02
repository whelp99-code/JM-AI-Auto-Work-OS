import test from "node:test";
import assert from "node:assert/strict";
import { inferMissionType, inferRiskLevel, normalizeMissionInput } from "../src/lib/contracts";
import { organizationTemplateFor } from "../src/lib/templates";
import { PRODUCT, RUNTIME_BOUNDARIES } from "../src/lib/product";

test("product definition remains work automation, not ProofGraph", () => {
  assert.equal(PRODUCT.version, "0.9.0");
  assert.match(PRODUCT.definition, /업무 자동화/);
  assert.match(RUNTIME_BOUNDARIES.proofGraph, /별도/);
});

test("mission classification selects domain organization templates", () => {
  assert.equal(inferMissionType("운영 대시보드 UX/UI 디자인"), "design");
  assert.equal(inferMissionType("신제품 마케팅 캠페인"), "marketing");
  assert.equal(inferMissionType("고객 문의 대응 프로세스"), "customer_support");
  assert.equal(organizationTemplateFor("design").departments[0].key, "design");
});

test("risk classification fails closed for irreversible actions", () => {
  assert.equal(inferRiskLevel({ objective: "보고서를 작성한다" }), "GREEN");
  assert.equal(inferRiskLevel({ objective: "고객에게 이메일을 발송한다" }), "YELLOW");
  assert.equal(inferRiskLevel({ objective: "프로덕션 배포 후 결제한다" }), "RED");
});

test("mission input validates budget and objective", () => {
  const normalized = normalizeMissionInput({ objective: "시장 조사", budgetUsd: 3 });
  assert.equal(normalized.missionType, "research");
  assert.throws(() => normalizeMissionInput({ objective: "", budgetUsd: 1 }), /required/);
  assert.throws(() => normalizeMissionInput({ objective: "x", budgetUsd: 0 }), /between/);
});
