import { parseJson, serializeBigInt } from "@/lib/json";
import { prisma } from "./db";
import { organizationView } from "./organization-service";

export async function missionWorkspace(runId: string) {
  const run = await prisma.missionRun.findUnique({
    where: { id: runId },
    include: {
      mission: true,
      workItems: { include: { agent: { include: { role: true } }, orgUnit: true }, orderBy: { sequence: "asc" } },
      steps: { include: { agent: { include: { role: true } } }, orderBy: { createdAt: "asc" } },
      transitions: { orderBy: { sequence: "asc" } },
      reviews: { orderBy: { createdAt: "desc" } },
      approvals: { orderBy: { createdAt: "desc" } },
      councils: { include: { messages: { orderBy: { createdAt: "asc" } }, decisions: { orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } },
      decisions: { orderBy: { createdAt: "desc" } },
      artifacts: { orderBy: [{ artifactType: "asc" }, { version: "desc" }] },
      effects: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "desc" }, take: 250 }
    }
  });
  if (!run) throw new Error("not_found");
  const organization = await organizationView(runId);
  const totalWork = run.workItems.length;
  const completedWork = run.workItems.filter((item) => item.status === "completed").length;
  const blockingReviews = run.reviews.filter((review) => review.verdict === "failed" || parseJson<unknown[]>(review.failureJson, []).length > 0).length;
  const pendingApprovals = run.approvals.filter((approval) => approval.status === "pending").length;
  const progress = totalWork === 0 ? 0 : Math.round((completedWork / totalWork) * 100);
  return serializeBigInt({
    schemaVersion: "mission-workspace.v0.9.0",
    run,
    mission: run.mission,
    organization,
    overview: {
      status: run.status, currentStep: run.currentStepKey, progress,
      work: { total: totalWork, completed: completedWork },
      approvals: { pending: pendingApprovals }, reviews: { total: run.reviews.length, blocking: blockingReviews },
      artifacts: run.artifacts.length, agents: organization.agents.length, teams: organization.units.filter((unit) => unit.unitType === "team").length,
      nextAction: pendingApprovals > 0 ? "승인 요청을 검토하세요." : blockingReviews > 0 ? "검증 실패를 검토하세요." : run.status === "simulated" ? "최종 산출물을 확인하세요." : "Workflow 진행 상태를 확인하세요."
    }
  });
}
