"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type JsonObject = Record<string, unknown>;
type Unit = { id: string; parentId: string | null; unitType: string; name: string; objective: string; status: string; key: string };
type Role = { id: string; orgUnitId: string | null; title: string; key: string; isLead: boolean; isVerifier: boolean; category: string };
type Agent = { id: string; orgUnitId: string | null; roleId: string; managerAgentId: string | null; name: string; status: string };
type WorkItem = { id: string; key: string; title: string; objective: string; status: string; riskLevel: string; outputJson: string | null; evidenceJson: string; agent?: { id: string; name: string; role: Role } | null; orgUnit?: Unit | null };
type Step = { id: string; key: string; stepType: string; status: string; roleKey: string | null; outputJson: string | null; createdAt: string; agent?: { name: string; role: Role } | null };
type Approval = { id: string; approvalType: string; status: string; riskLevel: string; scopeHash: string; requestJson: string; createdAt: string };
type Review = { id: string; reviewType: string; status: string; verdict: string | null; severity: string; score: number; confidence: number; summary: string; failureJson: string; workItemId: string | null };
type Artifact = { id: string; artifactType: string; title: string; version: number; status: string; contentText: string; createdAt: string };
type Council = { id: string; topic: string; status: string; messages: Array<{ id: string; speakerType: string; messageType: string; content: string }>; decisions: Array<{ id: string; summary: string; rationale: string; confidence: number }> };
type Event = { id: string; eventType: string; sourceType: string; severity: string; message: string; createdAt: string };
type Snapshot = {
  schemaVersion: string;
  run: { id: string; status: string; currentStepKey: string | null; resultJson: string | null; steps: Step[]; transitions: unknown[]; reviews: Review[]; approvals: Approval[]; councils: Council[]; artifacts: Artifact[]; events: Event[]; effects: unknown[]; workItems: WorkItem[] };
  mission: { id: string; title: string; objective: string; missionType: string; status: string; riskLevel: string; budgetMicros: string; spentMicros: string };
  organization: { units: Unit[]; roles: Role[]; agents: Agent[] };
  overview: { status: string; currentStep: string | null; progress: number; work: { total: number; completed: number }; approvals: { pending: number }; reviews: { total: number; blocking: number }; artifacts: number; agents: number; teams: number; nextAction: string };
};

const tabs = ["overview", "organization", "workflow", "approvals", "council", "evidence", "artifacts", "audit"] as const;
type Tab = typeof tabs[number];
const labels: Record<Tab, string> = { overview: "개요", organization: "AI 조직", workflow: "Workflow", approvals: "승인", council: "AI Council", evidence: "검증·증거", artifacts: "산출물", audit: "감사 기록" };

function json<T>(value: string | null | undefined, fallback: T): T { try { return value ? JSON.parse(value) as T : fallback; } catch { return fallback; } }
function badgeClass(status: string) { const text = status.toLowerCase(); return text.includes("fail") || text.includes("reject") || text.includes("block") ? "red" : text.includes("pending") || text.includes("waiting") ? "amber" : text.includes("complete") || text.includes("pass") || text.includes("simulated") || text.includes("approved") ? "green" : "blue"; }
function date(value: string) { return new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }

export function MissionWorkspace({ runId }: { runId: string }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/workspace`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "workspace_load_failed");
      setData(body); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "불러오기 실패"); }
    finally { setLoading(false); }
  }, [runId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!data || ["completed", "simulated", "failed", "blocked"].includes(data.run.status)) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5000);
    return () => window.clearInterval(timer);
  }, [data, load]);

  async function decide(approval: Approval, decision: "approved" | "rejected") {
    setBusy(approval.id);
    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(approval.id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision, scopeHash: approval.scopeHash }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "approval_failed"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "승인 처리 실패"); }
    finally { setBusy(""); }
  }

  const organizationTree = useMemo(() => {
    if (!data) return [] as Array<{ unit: Unit; roles: Role[]; agents: Agent[]; children: Unit[] }>;
    return data.organization.units.map((unit) => ({
      unit,
      roles: data.organization.roles.filter((role) => role.orgUnitId === unit.id),
      agents: data.organization.agents.filter((agent) => agent.orgUnitId === unit.id),
      children: data.organization.units.filter((child) => child.parentId === unit.id)
    }));
  }, [data]);

  if (loading) return <main className="app-shell"><div className="panel loading-state">Mission Workspace를 구성하는 중…</div></main>;
  if (error && !data) return <main className="app-shell"><div className="error-box">{error}</div><a href="/" className="secondary-button">Command Center</a></main>;
  if (!data) return null;

  return <main className="workspace-shell">
    <aside className="workspace-sidebar">
      <a className="brand" href="/"><span>AI</span><div><b>Work Automation OS</b><small>v0.9.0 · Local</small></div></a>
      <div className="mission-identity"><span className={`badge ${data.mission.riskLevel === "RED" ? "red" : data.mission.riskLevel === "YELLOW" ? "amber" : "green"}`}>{data.mission.riskLevel}</span><h2>{data.mission.title}</h2><p>{data.mission.objective}</p></div>
      <nav className="tab-nav">{tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{labels[item]}{item === "approvals" && data.overview.approvals.pending > 0 ? <em>{data.overview.approvals.pending}</em> : null}</button>)}</nav>
      <div className="sidebar-foot"><a href="/settings/database">Core DB v2</a><a href="/">모든 미션</a></div>
    </aside>

    <section className="workspace-main">
      <header className="workspace-header"><div><div className="eyebrow">MISSION WORKSPACE · {data.mission.missionType}</div><h1>{labels[tab]}</h1><p>{data.overview.nextAction}</p></div><div className="header-actions"><span className={`badge ${badgeClass(data.run.status)}`}>{data.run.status}</span><button className="secondary-button" onClick={() => void load()}>새로고침</button></div></header>
      {error && <div className="error-box">{error}</div>}

      {tab === "overview" && <div className="content-stack">
        <section className="metric-grid"><article className="metric-card"><span>진행률</span><strong>{data.overview.progress}%</strong><small>{data.overview.work.completed}/{data.overview.work.total} 작업</small></article><article className="metric-card"><span>현재 단계</span><strong>{data.overview.currentStep ?? "대기"}</strong><small>{data.run.status}</small></article><article className="metric-card"><span>AI 조직</span><strong>{data.overview.agents}</strong><small>{data.overview.teams}개 팀</small></article><article className="metric-card"><span>품질</span><strong>{data.overview.reviews.blocking === 0 ? "정상" : `${data.overview.reviews.blocking} 차단`}</strong><small>{data.overview.reviews.total} reviews</small></article></section>
        <section className="two-column"><article className="panel"><div className="panel-heading"><h2>실행 상태</h2><span className="badge blue">Inline</span></div><div className="progress-track"><span style={{ width: `${data.overview.progress}%` }} /></div><dl className="summary-list"><div><dt>업무 유형</dt><dd>{data.mission.missionType}</dd></div><div><dt>위험도</dt><dd>{data.mission.riskLevel}</dd></div><div><dt>대기 승인</dt><dd>{data.overview.approvals.pending}</dd></div><div><dt>산출물</dt><dd>{data.overview.artifacts}</dd></div></dl></article><article className="panel"><div className="panel-heading"><h2>작업 소유권</h2><span className="badge green">Team-based</span></div>{data.run.workItems.map((work) => <div className="compact-row" key={work.id}><div><b>{work.title}</b><small>{work.agent?.name ?? "미배정"} · {work.orgUnit?.name ?? "조직"}</small></div><span className={`badge ${badgeClass(work.status)}`}>{work.status}</span></div>)}</article></section>
      </div>}

      {tab === "organization" && <div className="org-board">{organizationTree.filter((entry) => !entry.unit.parentId).map((root) => <section key={root.unit.id} className="panel org-root"><div className="panel-heading"><div><span className="badge blue">Executive</span><h2>{root.unit.name}</h2></div><span>{root.agents.length} agents</span></div><p>{root.unit.objective}</p><div className="department-grid">{root.children.map((department) => {
        const details = organizationTree.find((entry) => entry.unit.id === department.id)!;
        return <article key={department.id} className="department-card"><h3>{department.name}</h3><p>{department.objective}</p><div className="team-stack">{details.children.map((team) => {
          const teamDetails = organizationTree.find((entry) => entry.unit.id === team.id)!;
          return <div key={team.id} className="team-card"><div><b>{team.name}</b><small>{team.objective}</small></div><ul>{teamDetails.agents.map((agent) => { const role = data.organization.roles.find((item) => item.id === agent.roleId); return <li key={agent.id}><span className={role?.isVerifier ? "agent-dot verifier" : role?.isLead ? "agent-dot lead" : "agent-dot"} /><div><b>{agent.name}</b><small>{role?.category}{role?.isVerifier ? " · 독립 검증" : ""}</small></div></li>; })}</ul></div>;
        })}</div></article>;
      })}</div></section>)}</div>}

      {tab === "workflow" && <div className="content-stack"><section className="panel"><div className="panel-heading"><h2>상태 기반 실행 경로</h2><span className="badge blue">{data.run.steps.length} steps</span></div><div className="workflow-timeline">{data.run.steps.map((step, index) => <div className={`workflow-step ${step.status}`} key={step.id}><div className="step-index">{index + 1}</div><div><b>{step.key}</b><small>{step.stepType} · {step.agent?.name ?? step.roleKey ?? "runtime"}</small></div><span className={`badge ${badgeClass(step.status)}`}>{step.status}</span></div>)}</div></section></div>}

      {tab === "approvals" && <section className="panel"><div className="panel-heading"><h2>통합 승인함</h2><span className="badge amber">{data.overview.approvals.pending} pending</span></div>{data.run.approvals.length === 0 ? <div className="empty-state">승인 요청이 없습니다.</div> : data.run.approvals.map((approval) => <article className="approval-card" key={approval.id}><div><span className={`badge ${approval.riskLevel === "RED" ? "red" : "amber"}`}>{approval.riskLevel}</span><h3>{approval.approvalType}</h3><p>{String(json<JsonObject>(approval.requestJson, {}).action ?? "Workflow 진행 승인")}</p><small>{date(approval.createdAt)}</small></div><div>{approval.status === "pending" ? <><button className="primary-button small" disabled={busy === approval.id} onClick={() => void decide(approval, "approved")}>승인</button><button className="danger-button small" disabled={busy === approval.id} onClick={() => void decide(approval, "rejected")}>거절</button></> : <span className={`badge ${badgeClass(approval.status)}`}>{approval.status}</span>}</div></article>)}</section>}

      {tab === "council" && <div className="content-stack">{data.run.councils.length === 0 ? <div className="panel empty-state">이 미션에는 Council 세션이 필요하지 않았습니다.</div> : data.run.councils.map((session) => <section className="panel" key={session.id}><div className="panel-heading"><div><span className="badge green">Decision support</span><h2>{session.topic}</h2></div><span>{session.status}</span></div><div className="council-grid">{session.messages.map((message) => <article key={message.id} className="council-message"><span>{message.speakerType}</span><h3>{message.messageType}</h3><p>{message.content}</p></article>)}</div>{session.decisions.map((decision) => <div className="decision-box" key={decision.id}><b>채택된 결정</b><p>{decision.summary}</p><small>Confidence {Math.round(decision.confidence * 100)}% · {decision.rationale}</small></div>)}</section>)}</div>}

      {tab === "evidence" && <section className="panel"><div className="panel-heading"><h2>독립 검증과 증거</h2><span className="badge green">Verifier separated</span></div>{data.run.reviews.length === 0 ? <div className="empty-state">아직 검증 결과가 없습니다.</div> : data.run.reviews.map((review) => <article className="review-card" key={review.id}><div><span className={`badge ${badgeClass(review.verdict ?? review.status ?? "pending")}`}>{review.verdict ?? "pending"}</span><h3>{review.reviewType}</h3><p>{review.summary}</p></div><div className="score-ring">{Math.round(review.score * 100)}<small>%</small></div>{json<unknown[]>(review.failureJson, []).length > 0 ? <pre>{JSON.stringify(json(review.failureJson, []), null, 2)}</pre> : null}</article>)}</section>}

      {tab === "artifacts" && <div className="content-stack">{data.run.artifacts.length === 0 ? <div className="panel empty-state">검증을 통과한 산출물이 아직 없습니다.</div> : data.run.artifacts.map((artifact) => <article className="panel artifact-card" key={artifact.id}><div className="panel-heading"><div><span className="badge green">{artifact.status}</span><h2>{artifact.title}</h2></div><div><button className="secondary-button" onClick={() => navigator.clipboard.writeText(artifact.contentText)}>복사</button><button className="secondary-button" onClick={() => { const blob = new Blob([artifact.contentText], { type: "text/markdown" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${artifact.artifactType}-v${artifact.version}.md`; link.click(); URL.revokeObjectURL(link.href); }}>다운로드</button></div></div><pre className="markdown-preview">{artifact.contentText}</pre></article>)}</div>}

      {tab === "audit" && <section className="panel"><div className="panel-heading"><h2>감사 타임라인</h2><span className="badge blue">{data.run.events.length} events</span></div><div className="audit-list">{data.run.events.map((event) => <div key={event.id} className="audit-row"><span className={`event-dot ${event.severity}`} /><div><b>{event.message}</b><small>{event.sourceType} · {event.eventType}</small></div><time>{date(event.createdAt)}</time></div>)}</div></section>}
    </section>
  </main>;
}
