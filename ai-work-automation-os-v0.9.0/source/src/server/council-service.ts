import { newId } from "@/lib/ids";
import { stringifyJson } from "@/lib/json";
import { prisma } from "./db";
import { appendEvent } from "./event-service";

export async function ensureMissionCouncil(missionRunId: string) {
  return prisma.$transaction(async (tx) => {
    const run = await tx.missionRun.findUnique({ where: { id: missionRunId }, include: { mission: true } });
    if (!run) throw new Error("not_found");
    const existing = await tx.councilSession.findFirst({ where: { missionRunId } });
    if (existing) return existing;
    const session = await tx.councilSession.create({ data: {
      id: newId("council"), missionId: run.missionId, missionRunId,
      topic: run.mission.objective, status: "completed", currentRound: 1,
      configJson: stringifyJson({ mode: "synthetic", roles: ["Strategist", "Critic", "Synthesizer"] }),
      completedAt: new Date()
    }});
    const messages = [
      { speakerType: "strategist", messageType: "analysis", content: `목표를 ${run.mission.missionType} 업무로 분류하고, 결과물이 실제 사용 가능해야 한다는 기준을 제안합니다.` },
      { speakerType: "critic", messageType: "critique", content: `주요 위험은 범위 확대, 검증 없는 완료, 승인 없는 외부 행동입니다. 독립 검증과 범위 제한이 필요합니다.` },
      { speakerType: "synthesizer", messageType: "consensus", content: `전문 팀이 결과물을 만들고 독립 검증을 통과한 뒤 최종 산출물로 승격하는 실행안을 채택합니다.` }
    ];
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      await tx.councilMessage.create({ data: {
        id: newId("msg"), councilSessionId: session.id, round: 1,
        speakerType: message.speakerType, messageType: message.messageType,
        content: message.content, metadataJson: "{}"
      }});
    }
    await tx.decisionRecord.create({ data: {
      id: newId("decision"), missionId: run.missionId, missionRunId,
      councilSessionId: session.id, sourceType: "council", decisionType: "execution_strategy",
      status: "recorded", summary: "전문 역할 실행과 독립 검증을 결합한 제한적 실행 경로를 채택합니다.",
      rationale: "업무 자동화의 속도와 결과 신뢰성을 함께 확보하기 위해서입니다.", confidence: 0.82,
      alternativesJson: stringifyJson(["단일 역할 직접 실행", "사람 전담 처리"]),
      unresolvedJson: stringifyJson(run.mission.riskLevel === "RED" ? ["고위험 행동은 사람 승인 필요"] : []),
      evidenceJson: "[]"
    }});
    await appendEvent(tx, {
      workspaceId: run.mission.workspaceId, missionId: run.missionId, missionRunId,
      sourceType: "council", sourceId: session.id, eventType: "council.completed",
      message: "AI Council이 실행 전략과 위험 통제 기준을 정리했습니다.", data: { messages: messages.length }
    });
    return session;
  });
}
