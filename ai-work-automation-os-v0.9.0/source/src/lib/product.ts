export const PRODUCT = Object.freeze({
  name: "AI Work Automation OS",
  version: "0.9.0",
  definition:
    "자연어 업무 목표를 받아 필요한 AI 관리자·팀·전문 역할을 구성하고, 상태 기반 워크플로로 업무를 실행·검증·승인하여 산출물과 통제된 업무 행동으로 연결하는 Local-First 업무 자동화 운영체제",
  mode: "local-first",
  database: "SQLite",
  schemaVersion: "0.9.0",
  tableCount: 18
});

export const RUNTIME_BOUNDARIES = Object.freeze({
  council: "복수 관점 분석과 의사결정 지원 모듈",
  organization: "업무에 필요한 부서·팀·역할·에이전트 구성",
  workflow: "업무 상태·분기·재시도·승인·종료 제어",
  verification: "독립 검증·증거·실패 분류·완료 조건 관리",
  delivery: "검증된 산출물과 승인된 외부 행동 연결",
  proofGraph: "별도의 소프트웨어 개발 에이전트 도구이며 이 제품의 이름이나 검증 런타임이 아님"
});
