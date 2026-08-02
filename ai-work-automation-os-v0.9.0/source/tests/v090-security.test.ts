import test from "node:test";
import assert from "node:assert/strict";
import { stableHash } from "../src/lib/ids";
import { workflowPolicy } from "../src/lib/workflow-policy";

test("approval scope changes whenever target arguments change", () => {
  const a = stableHash({ target: "release-A", action: "publish" });
  const b = stableHash({ target: "release-B", action: "publish" });
  assert.notEqual(a, b);
});

test("high-risk workflow cannot be routed without approval", () => {
  assert.equal(workflowPolicy({ missionType: "operations", riskLevel: "RED" }).needsHumanApproval, true);
  assert.equal(workflowPolicy({ missionType: "operations", riskLevel: "GREEN" }).needsHumanApproval, false);
});
