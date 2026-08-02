"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ApprovalItem = {
  id: string;
  missionRunId: string;
  approvalType: string;
  status: string;
  riskLevel: string;
  scopeHash: string;
  requestJson: string;
  mission: { id: string; title: string; objective: string; riskLevel: string };
};

function parseRequest(value: string): Record<string, unknown> {
  try { return JSON.parse(value) as Record<string, unknown>; }
  catch { return {}; }
}

function Status({ value }: { value: string }) {
  return <span className={`badge ${value === "approved" ? "green" : value === "rejected" ? "red" : "amber"}`}>{value}</span>;
}

export function ApprovalsCenter() {
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/approvals", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "승인함 조회 실패");
    setApprovals(Array.isArray(body.approvals) ? body.approvals : []);
  }, []);

  useEffect(() => {
    refresh().catch((reason) => setError(reason instanceof Error ? reason.message : String(reason)));
  }, [refresh]);

  async function decide(approval: ApprovalItem, decision: "approved" | "rejected") {
    setBusy(approval.id);
    setError("");
    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(approval.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision, scopeHash: approval.scopeHash })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "승인 처리 실패");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy("");
    }
  }

  const pending = approvals.filter((approval) => approval.status === "pending").length;
  return <main className="app-shell">
    <header className="topbar compact">
      <div><div className="eyebrow">HUMAN CONTROL GATE</div><h1>통합 승인함 <span>v0.9.0</span></h1><p>고위험 업무와 외부 행동은 사용자 판단 전까지 중단됩니다.</p></div>
      <nav><Link className="nav-link" href="/">Command Center</Link><Link className="nav-link active" href="/approvals">승인함</Link></nav>
    </header>
    {error && <div className="error-box">{error}</div>}
    <section className="panel">
      <div className="panel-heading"><div><h2>승인 요청</h2><p>승인 범위 해시가 일치하는 현재 요청만 처리됩니다.</p></div><span className="badge amber">Pending {pending}</span></div>
      {approvals.length === 0 ? <div className="empty-state">승인 요청이 없습니다.</div> : <div className="content-stack">
        {approvals.map((approval) => {
          const request = parseRequest(approval.requestJson);
          return <article className="approval-card" key={approval.id}>
            <div><Status value={approval.status} /><h3>{approval.mission.title}</h3><p>{String(request.action ?? request.reason ?? "사람 승인이 필요한 요청입니다.")}</p><small>{approval.approvalType} · {approval.riskLevel}</small></div>
            <div><Link className="secondary-button small" href={`/missions/${approval.missionRunId}`}>업무 열기</Link>{approval.status === "pending" && <><button disabled={busy === approval.id} className="primary-button small" onClick={() => void decide(approval, "approved")}>승인</button><button disabled={busy === approval.id} className="danger-button small" onClick={() => void decide(approval, "rejected")}>거절</button></>}</div>
          </article>;
        })}
      </div>}
    </section>
  </main>;
}
