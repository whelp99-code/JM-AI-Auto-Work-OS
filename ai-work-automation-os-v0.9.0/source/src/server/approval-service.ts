import { parseJson, stringifyJson } from "@/lib/json";
import { prisma } from "./db";
import { appendEvent, approvalScopeHash } from "./event-service";
import { executeMissionRun } from "./workflow-service";

export async function listApprovals(status?: string) {
  return prisma.approval.findMany({
    where: status ? { status } : undefined,
    include: { mission: { select: { id: true, title: true, objective: true, riskLevel: true } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }]
  });
}

export async function resolveApproval(
  id: string,
  input: { decision: "approved" | "rejected"; comment?: string; scopeHash?: string }
) {
  const approval = await prisma.approval.findUnique({ where: { id }, include: { mission: true } });
  if (!approval) throw new Error("not_found");
  if (approval.status !== "pending") {
    if (approval.status === input.decision) return approval;
    throw new Error("approval_conflict");
  }
  if (approval.expiresAt && approval.expiresAt.getTime() <= Date.now()) throw new Error("approval_expired");

  const request = parseJson<Record<string, unknown>>(approval.requestJson, {});
  const expectedHash = approvalScopeHash(request);
  if (expectedHash !== approval.scopeHash || (input.scopeHash && input.scopeHash !== approval.scopeHash)) {
    throw new Error("approval_scope_mismatch");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.approval.updateMany({
      where: { id, status: "pending", scopeHash: approval.scopeHash },
      data: {
        status: input.decision,
        decidedBy: "local:owner",
        decidedAt: new Date(),
        decisionJson: stringifyJson({ decision: input.decision, comment: input.comment ?? "" })
      }
    });
    if (claimed.count !== 1) throw new Error("approval_conflict");

    await tx.decisionRecord.create({
      data: {
        missionId: approval.missionId,
        missionRunId: approval.missionRunId,
        approvalId: approval.id,
        sourceType: "human_approval",
        decisionType: approval.approvalType,
        status: "recorded",
        summary: input.decision === "approved" ? "사용자가 실행을 승인했습니다." : "사용자가 실행을 거절했습니다.",
        rationale: input.comment ?? "",
        confidence: 1,
        alternativesJson: "[]",
        unresolvedJson: "[]",
        evidenceJson: "[]"
      }
    });

    await appendEvent(tx, {
      workspaceId: approval.mission.workspaceId,
      missionId: approval.missionId,
      missionRunId: approval.missionRunId,
      sourceType: "approval",
      sourceId: approval.id,
      eventType: `approval.${input.decision}`,
      actorType: "user",
      actorId: "local:owner",
      severity: input.decision === "approved" ? "info" : "warning",
      message: input.decision === "approved" ? "사용자가 요청을 승인했습니다." : "사용자가 요청을 거절했습니다.",
      data: { comment: input.comment ?? "" }
    });

    if (input.decision === "rejected") {
      await tx.missionRun.update({
        where: { id: approval.missionRunId },
        data: { status: "blocked", errorCode: "approval_rejected", errorMessage: input.comment ?? "사용자 거절", completedAt: new Date() }
      });
      await tx.mission.update({
        where: { id: approval.missionId },
        data: { status: "blocked", currentStage: "approval_rejected" }
      });
      await tx.externalEffect.updateMany({
        where: { missionRunId: approval.missionRunId, status: "approval_required" },
        data: { status: "cancelled", errorCode: "approval_rejected", errorMessage: input.comment ?? "사용자 거절" }
      });
    }

    return tx.approval.findUniqueOrThrow({ where: { id } });
  });

  if (input.decision === "approved") await executeMissionRun(approval.missionRunId);
  return updated;
}
