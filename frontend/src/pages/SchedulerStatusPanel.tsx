import { useEffect, useState } from "react";
import { api } from "../api";

type SchedulerStatus = {
  jobName: string;
  status: "NEVER_RUN" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";
  lastStartedAt: string | null;
  lastSucceededAt: string | null;
  lastFailedAt: string | null;
  durationMs: number | null;
  message: string | null;
};

const JOB_LABELS: Record<string, string> = {
  "annual-leave-january-reset": "연차 1월 자동 생성",
  "approval-due-reminder": "전자결재 지연 알림",
  "comp-time-expiration": "대체휴무 만료 알림",
  "official-holiday-open-api": "공식 공휴일 OpenAPI 확인"
};

export function SchedulerStatusPanel() {
  const [items, setItems] = useState<SchedulerStatus[]>([]);
  const [error, setError] = useState("");
  async function load() {
    try {
      setItems(await api<SchedulerStatus[]>("/approval-operations/schedulers"));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "스케줄러 상태를 불러오지 못했습니다.");
    }
  }
  useEffect(() => { void load(); }, []);
  return <section className="approval-detail-section scheduler-status-panel"><div className="panel-head"><div><h3>자동 작업 상태</h3><p className="muted-text">연차, 결재 알림, 대체휴무, 공휴일 연동의 최근 실행 결과입니다.</p></div><button type="button" className="ghost" onClick={() => void load()}>새로고침</button></div>{error && <p className="error">{error}</p>}<div className="table-wrap"><table><thead><tr><th>작업</th><th>상태</th><th>최근 시작</th><th>최근 성공</th><th>최근 실패</th><th>결과</th></tr></thead><tbody>{items.map((item) => <tr key={item.jobName}><td>{JOB_LABELS[item.jobName] ?? item.jobName}</td><td><strong className={`scheduler-${item.status.toLowerCase()}`}>{item.status}</strong></td><td>{format(item.lastStartedAt)}</td><td>{format(item.lastSucceededAt)}</td><td>{format(item.lastFailedAt)}</td><td>{item.message ?? "-"}{item.durationMs != null ? ` · ${item.durationMs}ms` : ""}</td></tr>)}{!items.length && <tr><td colSpan={6} className="muted-text">아직 실행 이력이 없습니다.</td></tr>}</tbody></table></div></section>;
}

function format(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "-";
}
