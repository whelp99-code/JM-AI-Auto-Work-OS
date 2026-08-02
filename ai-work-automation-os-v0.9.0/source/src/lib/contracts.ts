export type RiskLevel = "GREEN" | "YELLOW" | "RED";
export type MissionType = "general" | "research" | "design" | "marketing" | "development" | "operations" | "finance" | "customer_support";

export type MissionInput = {
  title?: string;
  objective: string;
  missionType?: MissionType;
  priority?: "low" | "normal" | "high" | "urgent";
  riskLevel?: RiskLevel;
  budgetUsd?: number;
  successCriteria?: string[];
  constraints?: string[];
  requestedActions?: string[];
};

export type RoleTemplate = {
  key: string;
  title: string;
  category: string;
  capabilities: string[];
  permissions: string[];
  isLead?: boolean;
  isVerifier?: boolean;
};

export type TeamTemplate = {
  key: string;
  name: string;
  objective: string;
  capabilities: string[];
  roles: RoleTemplate[];
};

export type DepartmentTemplate = {
  key: string;
  name: string;
  objective: string;
  teams: TeamTemplate[];
};

export type WorkTemplate = {
  key: string;
  title: string;
  objective: string;
  workType: string;
  roleKey: string;
  criteria: string[];
};

export type OrganizationTemplate = {
  missionType: MissionType;
  departments: DepartmentTemplate[];
  workItems: WorkTemplate[];
};

const TYPE_KEYWORDS: Array<[MissionType, string[]]> = [
  ["design", ["디자인", "ux", "ui", "화면", "브랜드", "사용자 경험", "design"]],
  ["marketing", ["마케팅", "광고", "캠페인", "seo", "콘텐츠", "marketing"]],
  ["development", ["개발", "코드", "api", "소프트웨어", "앱", "웹", "development", "software"]],
  ["research", ["조사", "리서치", "분석", "시장", "research", "benchmark"]],
  ["operations", ["운영", "프로세스", "자동화", "업무", "operations", "workflow"]],
  ["finance", ["재무", "예산", "수익", "비용", "finance", "forecast"]],
  ["customer_support", ["고객", "지원", "문의", "cs", "customer support"]]
];

export function inferMissionType(objective: string): MissionType {
  const text = objective.toLowerCase();
  let best: { type: MissionType; score: number } = { type: "general", score: 0 };
  for (const [type, keywords] of TYPE_KEYWORDS) {
    const score = keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 1 : 0), 0);
    if (score > best.score) best = { type, score };
  }
  return best.type;
}

export function inferRiskLevel(input: MissionInput): RiskLevel {
  if (input.riskLevel) return input.riskLevel;
  const text = [input.objective, ...(input.constraints ?? []), ...(input.requestedActions ?? [])].join(" ").toLowerCase();
  if (/결제|송금|삭제|배포|외부\s*게시|고객\s*발송|production|payment|delete|deploy|publish/.test(text)) return "RED";
  if (/파일\s*수정|코드\s*변경|이메일|메시지|api\s*호출|write|send/.test(text)) return "YELLOW";
  return "GREEN";
}

export function normalizeMissionInput(input: MissionInput): Required<Omit<MissionInput, "title">> & { title: string } {
  const objective = input.objective?.trim();
  if (!objective) throw new Error("objective is required");
  const budgetUsd = Number(input.budgetUsd ?? 5);
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 10_000) throw new Error("budgetUsd must be between 0 and 10000");
  return {
    title: input.title?.trim() || objective.slice(0, 80),
    objective,
    missionType: input.missionType ?? inferMissionType(objective),
    priority: input.priority ?? "normal",
    riskLevel: inferRiskLevel(input),
    budgetUsd,
    successCriteria: (input.successCriteria ?? []).filter(Boolean).slice(0, 30),
    constraints: (input.constraints ?? []).filter(Boolean).slice(0, 30),
    requestedActions: (input.requestedActions ?? []).filter(Boolean).slice(0, 30)
  };
}
