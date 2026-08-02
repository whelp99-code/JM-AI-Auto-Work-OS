import type { MissionType, RiskLevel } from "./contracts";

export type WorkflowPolicy = {
  needsCouncil: boolean;
  needsResearch: boolean;
  needsHumanApproval: boolean;
  verificationProfile: "standard" | "adversarial";
  maxIterations: number;
};

export function workflowPolicy(input: { missionType: MissionType; riskLevel: RiskLevel; requestedActions?: string[] }): WorkflowPolicy {
  const needsResearch = ["research", "design", "marketing", "development", "finance"].includes(input.missionType);
  const needsHumanApproval = input.riskLevel === "RED";
  return {
    needsCouncil: input.missionType !== "general" || input.riskLevel !== "GREEN",
    needsResearch,
    needsHumanApproval,
    verificationProfile: input.riskLevel === "RED" || input.missionType === "development" ? "adversarial" : "standard",
    maxIterations: input.riskLevel === "GREEN" ? 2 : 1
  };
}

export function workflowPath(policy: WorkflowPolicy): string[] {
  const result = ["budget_guard", "triage"];
  if (policy.needsResearch) result.push("research");
  result.push("plan", "council", "risk_gate");
  if (policy.needsHumanApproval) result.push("human_approval");
  result.push("execute", "verify", "synthesize", "final_verify", "final_gate", "finalize");
  return result;
}
