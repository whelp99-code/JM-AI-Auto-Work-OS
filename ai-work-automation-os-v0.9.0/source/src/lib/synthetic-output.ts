import type { MissionType } from "./contracts";

const sections: Record<MissionType, string[]> = {
  general: ["목표 해석", "실행 결과", "후속 조치"],
  research: ["조사 질문", "핵심 근거", "충돌과 한계", "결론"],
  design: ["사용자와 업무 흐름", "정보 구조", "화면·상태 명세", "접근성 기준"],
  marketing: ["대상 고객", "핵심 메시지", "채널별 실행안", "KPI"],
  development: ["기술 범위", "아키텍처", "구현 단위", "테스트·릴리스 기준"],
  operations: ["현행 프로세스", "자동화 흐름", "예외·승인", "운영 지표"],
  finance: ["가정과 데이터", "기준 시나리오", "민감도", "위험 요인"],
  customer_support: ["문의 분류", "해결 절차", "고객 응답", "에스컬레이션"]
};

export function createSyntheticWorkOutput(input: { missionType: MissionType; missionObjective: string; title: string; objective: string }): { markdown: string; evidence: Array<{ type: string; summary: string }> } {
  const headings = sections[input.missionType] ?? sections.general;
  const body = headings.map((heading, index) => `## ${heading}\n\n${index === 0 ? input.missionObjective : input.objective}를 기준으로 실행 가능한 내용을 구조화했습니다.`).join("\n\n");
  return {
    markdown: `# ${input.title}\n\n${body}\n\n## 완료 기준\n\n- 목표와 결과가 직접 연결되어야 합니다.\n- 가정과 미해결 항목을 숨기지 않습니다.\n- 승인되지 않은 외부 행동은 실행하지 않습니다.`,
    evidence: [
      { type: "runtime_observation", summary: "요구사항과 성공 기준을 입력으로 사용했습니다." },
      { type: "synthetic_result", summary: "v0.9.0 로컬 합성 실행기가 결과를 생성했습니다." }
    ]
  };
}

export function synthesizeFinalArtifact(input: { title: string; objective: string; work: Array<{ title: string; markdown: string }>; councilDecision?: string | null }): string {
  const work = input.work.map((item) => `## ${item.title}\n\n${item.markdown}`).join("\n\n---\n\n");
  return `# ${input.title}\n\n## 업무 목표\n\n${input.objective}\n\n## AI Council 결정\n\n${input.councilDecision ?? "전문 역할 실행 후 독립 검증을 거쳐 결과를 승격합니다."}\n\n## 팀별 결과\n\n${work}\n\n## 품질 상태\n\n모든 포함 결과는 독립 검증 기록과 연결됩니다. 이 산출물은 로컬 합성 실행 결과이며 승인되지 않은 외부 행동을 포함하지 않습니다.`;
}
