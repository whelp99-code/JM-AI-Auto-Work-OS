"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MissionListItem = {
  id: string; title: string; objective: string; missionType: string; status: string; riskLevel: string;
  updatedAt: string; runs: Array<{ id: string; status: string; currentStepKey?: string | null }>;
  _count: { workItems: number; artifacts: number; approvals: number };
};
type DatabaseStatus = { healthy: boolean; tableCount: number; schemaVersion: string; counts: Record<string, number>; sizeBytes: number };

const missionTypes = [
  ["auto", "자동 분류"], ["general", "일반 업무"], ["research", "조사·분석"], ["design", "디자인"],
  ["marketing", "마케팅"], ["development", "개발"], ["operations", "운영"], ["finance", "재무"], ["customer_support", "고객지원"]
];

export function CommandCenter() {
  const router = useRouter();
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [database, setDatabase] = useState<DatabaseStatus | null>(null);
  const [objective, setObjective] = useState("");
  const [missionType, setMissionType] = useState("auto");
  const [budget, setBudget] = useState("5");
  const [criteria, setCriteria] = useState("");
  const [actions, setActions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [missionResponse, dbResponse] = await Promise.all([fetch("/api/missions", { cache: "no-store" }), fetch("/api/system/database", { cache: "no-store" })]);
    if (missionResponse.ok) setMissions(await missionResponse.json());
    if (dbResponse.ok) setDatabase(await dbResponse.json());
  }
  useEffect(() => { void load(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/missions", {
        method: "POST", headers: { "content-type": "application/json", "idempotency-key": `ui-${Date.now()}-${objective.length}` },
        body: JSON.stringify({
          objective, missionType: missionType === "auto" ? undefined : missionType,
          budgetUsd: Number(budget), successCriteria: criteria.split("\n").map((value) => value.trim()).filter(Boolean),
          requestedActions: actions.split("\n").map((value) => value.trim()).filter(Boolean)
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "mission_create_failed");
      if (data.run?.id) router.push(`/missions/${data.run.id}`);
      else await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "요청 실패"); }
    finally { setBusy(false); }
  }

  return <main className="app-shell">
    <header className="topbar">
      <div><div className="eyebrow">LOCAL-FIRST · SINGLE USER</div><h1>AI Work Automation OS <span>v0.9.0</span></h1><p>목표를 입력하면 필요한 AI 조직이 구성되고, 실행·검증·승인·산출물까지 이어집니다.</p></div>
      <nav><a className="nav-link active" href="/">Command Center</a><a className="nav-link" href="/settings/database">Core DB</a></nav>
    </header>

    <section className="hero-grid">
      <form className="panel mission-form" onSubmit={submit}>
        <div className="panel-heading"><div><span className="step-number">1</span><h2>새 업무 목표</h2></div><span className="badge green">즉시 로컬 실행</span></div>
        <label>업무 목표<textarea required value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="예: 신규 운영 대시보드의 UX/UI와 실행 계획을 설계하라." rows={5} /></label>
        <div className="form-row"><label>업무 유형<select value={missionType} onChange={(event) => setMissionType(event.target.value)}>{missionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>예산 상한(USD)<input type="number" min="0.1" max="10000" step="0.1" value={budget} onChange={(event) => setBudget(event.target.value)} /></label></div>
        <label>성공 조건 <small>한 줄에 하나</small><textarea value={criteria} onChange={(event) => setCriteria(event.target.value)} rows={3} placeholder="사용자 흐름이 완결되어야 한다.&#10;검증 가능한 산출물이 생성되어야 한다." /></label>
        <label>요청 행동 <small>외부 게시·배포·결제는 승인 요청으로 전환</small><textarea value={actions} onChange={(event) => setActions(event.target.value)} rows={2} placeholder="선택 입력" /></label>
        {error && <div className="error-box">{error}</div>}
        <button className="primary-button" disabled={busy || objective.trim().length < 3}>{busy ? "AI 조직과 Workflow 구성 중…" : "업무 자동화 시작"}</button>
      </form>

      <aside className="panel db-card">
        <div className="panel-heading"><div><span className="step-number">DB</span><h2>Core DB v2</h2></div><span className={`badge ${database?.healthy ? "green" : "amber"}`}>{database?.healthy ? "정상" : "확인 필요"}</span></div>
        <div className="database-visual"><strong>{database?.tableCount ?? 18}</strong><span>canonical tables</span></div>
        <dl className="summary-list"><div><dt>Schema</dt><dd>{database?.schemaVersion ?? "0.9.0"}</dd></div><div><dt>Engine</dt><dd>SQLite</dd></div><div><dt>실행</dt><dd>Inline</dd></div><div><dt>미션</dt><dd>{database?.counts?.missions ?? 0}</dd></div><div><dt>산출물</dt><dd>{database?.counts?.artifacts ?? 0}</dd></div></dl>
        <p className="muted">v0.8.0의 44개 모델을 18개 업무 코어로 리빌드했습니다. 조직·실행·검증·승인·산출물의 중복 상태를 제거했습니다.</p>
        <a className="secondary-button" href="/settings/database">DB 구조와 마이그레이션 보기</a>
      </aside>
    </section>

    <section className="panel mission-list-panel">
      <div className="panel-heading"><div><span className="step-number">2</span><h2>업무 미션</h2></div><button className="text-button" onClick={() => void load()}>새로고침</button></div>
      {missions.length === 0 ? <div className="empty-state"><strong>첫 업무 목표를 등록하세요.</strong><span>미션·조직·Workflow·검증 기록이 로컬 DB에 저장됩니다.</span></div> : <div className="mission-grid">{missions.map((mission) => {
        const run = mission.runs[0];
        return <button key={mission.id} className="mission-card" onClick={() => run && router.push(`/missions/${run.id}`)} disabled={!run}>
          <div className="mission-card-top"><span className={`badge ${mission.riskLevel === "RED" ? "red" : mission.riskLevel === "YELLOW" ? "amber" : "green"}`}>{mission.riskLevel}</span><span className="type-label">{mission.missionType}</span></div>
          <h3>{mission.title}</h3><p>{mission.objective}</p>
          <div className="mission-meta"><span>상태 <b>{run?.status ?? mission.status}</b></span><span>작업 <b>{mission._count.workItems}</b></span><span>산출물 <b>{mission._count.artifacts}</b></span></div>
        </button>;
      })}</div>}
    </section>
  </main>;
}
