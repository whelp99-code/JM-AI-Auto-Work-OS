import type { MissionType, OrganizationTemplate, RoleTemplate, TeamTemplate, WorkTemplate } from "./contracts";

const verifier = (key: string, title: string, capabilities: string[]): RoleTemplate => ({
  key,
  title,
  category: "verifier",
  capabilities,
  permissions: ["artifact:read", "test:run", "review:create"],
  isVerifier: true
});

const team = (key: string, name: string, objective: string, specialist: RoleTemplate, verify: RoleTemplate): TeamTemplate => ({
  key,
  name,
  objective,
  capabilities: [...new Set([...specialist.capabilities, ...verify.capabilities])],
  roles: [
    {
      key: `${key}-lead`,
      title: `${name} Lead`,
      category: "manager",
      capabilities: ["planning", "delegation", ...specialist.capabilities],
      permissions: ["work:assign", "artifact:read", "artifact:write", "agent:request"],
      isLead: true
    },
    specialist,
    verify
  ]
});

const baseWork = (key: string, title: string, objective: string, workType: string, roleKey: string, criteria: string[]): WorkTemplate => ({
  key,
  title,
  objective,
  workType,
  roleKey,
  criteria
});

const general: OrganizationTemplate = {
  missionType: "general",
  departments: [{
    key: "operations",
    name: "업무 운영부",
    objective: "목표를 구체화하고 실행 가능한 업무 결과로 완성한다.",
    teams: [team(
      "general-team",
      "업무 실행팀",
      "목표 분석, 계획, 실행, 검증을 수행한다.",
      { key: "general-specialist", title: "업무 전문가", category: "specialist", capabilities: ["analysis", "planning", "execution", "documentation"], permissions: ["artifact:read", "artifact:write"] },
      verifier("general-verifier", "독립 업무 검증자", ["quality-assurance", "requirements-check"])
    )]
  }],
  workItems: [
    baseWork("analyze", "목표와 요구사항 분석", "업무 목표, 제약, 성공 조건을 구조화한다.", "analysis", "general-specialist", ["목표가 명확하다", "제약 조건이 반영됐다"]),
    baseWork("execute", "업무 결과 작성", "분석을 토대로 실행 가능한 결과물을 작성한다.", "execution", "general-specialist", ["요구사항을 충족한다", "결과물이 사용 가능하다"])
  ]
};

const research: OrganizationTemplate = {
  missionType: "research",
  departments: [{
    key: "research",
    name: "리서치부",
    objective: "근거를 수집하고 충돌을 비교해 검증 가능한 결론을 만든다.",
    teams: [team(
      "research-team",
      "조사·분석팀",
      "자료 수집, 비교 분석, 근거 정리를 담당한다.",
      { key: "researcher", title: "리서처", category: "researcher", capabilities: ["research", "source-analysis", "synthesis"], permissions: ["source:read", "artifact:write"] },
      verifier("research-verifier", "근거 검증자", ["source-verification", "bias-check"])
    )]
  }],
  workItems: [
    baseWork("research-plan", "조사 계획", "조사 질문, 출처 기준, 비교 기준을 정의한다.", "research", "researcher", ["조사 범위가 명확하다", "출처 기준이 정의됐다"]),
    baseWork("research-findings", "근거 수집과 분석", "핵심 근거, 충돌, 한계를 정리한다.", "research", "researcher", ["근거가 추적 가능하다", "충돌과 한계가 표시됐다"])
  ]
};

const design: OrganizationTemplate = {
  missionType: "design",
  departments: [{
    key: "design",
    name: "디자인부",
    objective: "사용자 요구를 이해하고 일관된 UX/UI 설계를 만든다.",
    teams: [
      team(
        "ux-team",
        "UX 리서치팀",
        "사용자, 업무 흐름, 정보 구조를 조사한다.",
        { key: "ux-researcher", title: "UX 리서처", category: "researcher", capabilities: ["user-research", "journey-mapping", "information-architecture"], permissions: ["source:read", "artifact:write"] },
        verifier("ux-verifier", "UX 검증자", ["usability-review", "requirements-check"])
      ),
      team(
        "ui-team",
        "UI 설계팀",
        "화면 구조, 상태, 컴포넌트 명세를 설계한다.",
        { key: "ui-designer", title: "UI 디자이너", category: "designer", capabilities: ["screen-design", "interaction-design", "design-system"], permissions: ["artifact:read", "artifact:write"] },
        verifier("design-verifier", "디자인 검증자", ["consistency-review", "accessibility-review"])
      )
    ]
  }],
  workItems: [
    baseWork("ux-analysis", "사용자 흐름 분석", "핵심 사용자와 업무 흐름, 정보 구조를 정의한다.", "design", "ux-researcher", ["사용자 흐름이 완결된다", "핵심 화면이 도출됐다"]),
    baseWork("ui-spec", "화면·컴포넌트 명세", "화면, 상태, 컴포넌트, 접근성 요구를 명세한다.", "design", "ui-designer", ["화면 상태가 정의됐다", "컴포넌트 재사용 기준이 있다", "접근성 기준이 있다"])
  ]
};

const marketing: OrganizationTemplate = {
  missionType: "marketing",
  departments: [{
    key: "marketing",
    name: "마케팅부",
    objective: "고객과 채널에 맞는 실행 가능한 마케팅 계획과 콘텐츠를 만든다.",
    teams: [team(
      "campaign-team",
      "캠페인팀",
      "시장·고객 분석, 메시지, 채널, 측정 계획을 구성한다.",
      { key: "marketing-specialist", title: "마케팅 전문가", category: "marketer", capabilities: ["market-analysis", "campaign-planning", "content-strategy"], permissions: ["source:read", "artifact:write"] },
      verifier("marketing-verifier", "마케팅 검증자", ["claim-review", "brand-review", "measurement-review"])
    )]
  }],
  workItems: [
    baseWork("audience", "고객·시장 분석", "대상 고객, 문제, 경쟁 대안을 정리한다.", "marketing", "marketing-specialist", ["대상 고객이 명확하다", "고객 문제와 가치가 연결된다"]),
    baseWork("campaign", "캠페인 계획", "메시지, 채널, 콘텐츠, KPI를 구성한다.", "marketing", "marketing-specialist", ["채널별 실행안이 있다", "KPI가 측정 가능하다"])
  ]
};

const development: OrganizationTemplate = {
  missionType: "development",
  departments: [{
    key: "engineering",
    name: "개발부",
    objective: "요구사항을 안전한 기술 설계와 구현 계획으로 전환한다.",
    teams: [team(
      "engineering-team",
      "제품 개발팀",
      "아키텍처, 구현, 테스트 결과를 만든다.",
      { key: "developer", title: "소프트웨어 개발 전문가", category: "developer", capabilities: ["software-design", "implementation", "testing"], permissions: ["workspace:read", "workspace:patch", "test:run", "artifact:write"] },
      verifier("code-verifier", "독립 코드 검증자", ["test-verification", "security-review", "requirements-check"])
    )]
  }],
  workItems: [
    baseWork("technical-plan", "기술 설계", "구현 범위, 계약, 데이터, 테스트 기준을 정의한다.", "development", "developer", ["구현 범위가 명확하다", "테스트 기준이 있다"]),
    baseWork("implementation", "구현 결과", "안전한 패치와 테스트 결과를 작성한다.", "development", "developer", ["요구사항을 충족한다", "검증 가능한 테스트가 있다"])
  ]
};

const operations: OrganizationTemplate = {
  missionType: "operations",
  departments: [{
    key: "operations",
    name: "운영부",
    objective: "반복 업무를 표준화하고 안정적인 운영 절차로 만든다.",
    teams: [team(
      "process-team",
      "프로세스 자동화팀",
      "현행 업무, 자동화 단계, 예외, 운영 지표를 설계한다.",
      { key: "operations-specialist", title: "운영 자동화 전문가", category: "operator", capabilities: ["process-analysis", "workflow-design", "operations"], permissions: ["source:read", "artifact:write"] },
      verifier("operations-verifier", "운영 검증자", ["control-review", "exception-review"])
    )]
  }],
  workItems: [
    baseWork("as-is", "현행 업무 분석", "현재 절차, 병목, 예외, 책임을 정리한다.", "operations", "operations-specialist", ["현재 흐름이 재현 가능하다", "예외가 식별됐다"]),
    baseWork("to-be", "자동화 운영 설계", "자동화 흐름, 승인, 복구, 지표를 정의한다.", "operations", "operations-specialist", ["승인 경계가 있다", "실패·복구 절차가 있다"])
  ]
};

const finance: OrganizationTemplate = {
  missionType: "finance",
  departments: [{
    key: "finance",
    name: "재무분석부",
    objective: "가정과 수치를 분리해 의사결정 가능한 재무 결과를 만든다.",
    teams: [team(
      "finance-team",
      "재무 분석팀",
      "비용, 수익, 시나리오를 분석한다.",
      { key: "finance-specialist", title: "재무 분석가", category: "analyst", capabilities: ["financial-analysis", "forecasting", "scenario-modeling"], permissions: ["source:read", "artifact:write"] },
      verifier("finance-verifier", "재무 검증자", ["calculation-review", "assumption-review"])
    )]
  }],
  workItems: [
    baseWork("assumptions", "가정과 데이터 정리", "계산에 필요한 가정과 데이터 출처를 명시한다.", "finance", "finance-specialist", ["가정과 사실이 구분됐다", "단위가 일관된다"]),
    baseWork("forecast", "재무 시나리오", "기준·낙관·보수 시나리오를 작성한다.", "finance", "finance-specialist", ["계산이 재현 가능하다", "위험 요인이 표시됐다"])
  ]
};

const customerSupport: OrganizationTemplate = {
  missionType: "customer_support",
  departments: [{
    key: "customer-success",
    name: "고객지원부",
    objective: "고객 문제를 분류하고 일관된 해결과 후속 조치를 설계한다.",
    teams: [team(
      "support-team",
      "고객 대응팀",
      "문의 분석, 답변, 에스컬레이션 기준을 만든다.",
      { key: "support-specialist", title: "고객지원 전문가", category: "support", capabilities: ["issue-triage", "customer-communication", "knowledge-management"], permissions: ["source:read", "artifact:write"] },
      verifier("support-verifier", "고객응대 검증자", ["policy-review", "tone-review", "resolution-review"])
    )]
  }],
  workItems: [
    baseWork("triage", "문의 분류", "문제 유형, 우선순위, 필요한 정보를 정리한다.", "customer_support", "support-specialist", ["문제가 올바르게 분류됐다", "필수 정보가 확인됐다"]),
    baseWork("response", "답변과 후속 조치", "정확한 답변, 해결 절차, 에스컬레이션을 작성한다.", "customer_support", "support-specialist", ["정책을 준수한다", "고객이 실행할 수 있다"])
  ]
};

const templates: Record<MissionType, OrganizationTemplate> = {
  general,
  research,
  design,
  marketing,
  development,
  operations,
  finance,
  customer_support: customerSupport
};

export function organizationTemplateFor(type: MissionType): OrganizationTemplate {
  return structuredClone(templates[type] ?? templates.general);
}
