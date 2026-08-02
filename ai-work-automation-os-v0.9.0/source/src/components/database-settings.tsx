"use client";
import { useEffect, useState } from "react";

type Status = { healthy: boolean; product: { version: string }; schemaVersion: string; tableCount: number; tables: string[]; databaseFile: string | null; sizeBytes: number; modifiedAt: string | null; counts: Record<string, number> };
export function DatabaseSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/system/database", { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setStatus(data); }).catch((cause) => setError(String(cause))); }, []);
  return <main className="app-shell"><header className="topbar compact"><div><div className="eyebrow">DATABASE REBUILD</div><h1>Core DB v2 <span>v0.9.0</span></h1><p>Local-First SQLite 데이터 모델과 마이그레이션 상태</p></div><nav><a className="nav-link" href="/">Command Center</a><a className="nav-link active" href="/settings/database">Core DB</a></nav></header>
    {error ? <div className="error-box">{error}</div> : !status ? <div className="panel">DB 상태 확인 중…</div> : <>
      <section className="metric-grid"><article className="metric-card"><span>DB 상태</span><strong>{status.healthy ? "정상" : "확인 필요"}</strong><small>Schema {status.schemaVersion}</small></article><article className="metric-card"><span>물리 테이블</span><strong>{status.tableCount}</strong><small>v0.8.0: 44 models</small></article><article className="metric-card"><span>DB 크기</span><strong>{(status.sizeBytes / 1024 / 1024).toFixed(2)} MB</strong><small>{status.databaseFile}</small></article><article className="metric-card"><span>감사 이벤트</span><strong>{status.counts.events ?? 0}</strong><small>단일 EventLog</small></article></section>
      <section className="db-domain-grid">
        {[
          ["조직", ["workspace","org_unit","role","agent"]], ["업무", ["mission","mission_run","work_item"]],
          ["Workflow", ["workflow_step","workflow_transition"]], ["품질·승인", ["review","approval"]],
          ["Council", ["council_session","council_message","decision_record"]], ["결과·운영", ["artifact","external_effect","event_log","file_asset"]]
        ].map(([name, values]) => <article className="panel domain-card" key={String(name)}><h2>{String(name)}</h2><div className="table-chips">{(values as string[]).map((table) => <code key={table}>{table}</code>)}</div></article>)}
      </section>
      <section className="panel"><div className="panel-heading"><h2>운영 명령</h2><span className="badge blue">Local only</span></div><div className="command-list"><code>npm run db:doctor</code><span>스키마·무결성·FK 검사</span><code>npm run db:backup</code><span>SQLite 일관 백업</span><code>npm run db:rebuild:dry-run</code><span>v0.8→v0.9 변환 계획 확인</span><code>npm run db:rebuild</code><span>백업 후 원자적 리빌드</span><code>npm run db:rollback:v0.8</code><span>리빌드 직전 DB로 롤백</span></div></section>
    </>}
  </main>;
}
