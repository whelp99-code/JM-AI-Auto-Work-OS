"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MissionListItem = {
  id: string;
  title: string;
  objective: string;
  missionType: string;
  riskLevel: string;
  status: string;
  runs: Array<{ id: string; status: string }>;
};

export function CouncilCenter() {
  const [missions, setMissions] = useState<MissionListItem[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/missions", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "업무 조회 실패");
    setMissions(Array.isArray(body) ? body : body.missions ?? []);
  }

  useEffect(() => {
    refresh().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, []);

  async function runCouncil(mission: MissionListItem) {
    setBusy(mission.id);
    setError("");
    try {
      let runId = mission.runs?.[0]?.id;
      if (!runId) {
        const runResponse = await fetch(`/api/missions/${encodeURIComponent(mission.id)}/runs`, {
          method: "POST",
          headers: { "idempotency-key": `council-${mission.id}` }
        });
        const runBody = await runResponse.json();
        if (!runResponse.ok) throw new Error(runBody.error || "실행 생성 실패");
        runId = runBody.id;
      }
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/council`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Council 실행 실패");
      location.assign(`/missions/${runId}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy("");
    }
  }

  return <main className="app-shell">
    <header className="topbar compact">
      <div><div className="eyebrow">DECISION SUPPORT MODULE</div><h1>AI Council <span>v0.9.0</span></h1><p>복수 관점 분석, 대안 비교, 충돌 검토를 제공하는 업무 의사결정 지원 모듈입니다.</p></div>
      <nav><Link className="nav-link" href="/">Command Center</Link><Link className="nav-link active" href="/council">AI Council</Link></nav>
    </header>
    {error && <div className="error-box">{error}</div>}
    <section className="panel">
      <div className="panel-heading"><div><h2>Council을 소집할 업무</h2><p>실행 전략이 필요하거나 여러 관점의 비교가 필요한 업무를 선택합니다.</p></div><span className="badge blue">{missions.length} missions</span></div>
      {missions.length === 0 ? <div className="empty-state">먼저 Command Center에서 업무 목표를 생성하세요.</div> : <div className="mission-grid">
        {missions.map((mission) => <article className="mission-card" key={mission.id}>
          <header><span className={`badge ${mission.riskLevel === "RED" ? "red" : mission.riskLevel === "YELLOW" ? "amber" : "green"}`}>{mission.riskLevel}</span><span className="badge blue">{mission.missionType}</span></header>
          <h3>{mission.title}</h3><p>{mission.objective}</p>
          <footer><button className="primary-button small" disabled={busy === mission.id} onClick={() => void runCouncil(mission)}>{busy === mission.id ? "Council 분석 중…" : "Council 소집"}</button>{mission.runs?.[0] && <Link href={`/missions/${mission.runs[0].id}`} className="secondary-button small">Workspace</Link>}</footer>
        </article>)}
      </div>}
    </section>
  </main>;
}
