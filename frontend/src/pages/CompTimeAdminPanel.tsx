import { CalendarClock, Plus, RefreshCw } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { api, jsonBody } from "../api";
import type { Employee, User } from "../types";
import { todayDate } from "../utils/approvalDomain";

type CompTimeCredit = {
  creditId: number;
  empId: number;
  empName: string;
  workDate: string;
  grantedDays: number;
  reservedDays: number;
  usedDays: number;
  availableDays: number;
  reason: string;
  grantedByName: string;
  expiresOn: string;
  status: "ACTIVE" | "EXPIRED" | "EXHAUSTED";
};

type CompTimeSummary = {
  empId: number;
  empName: string;
  availableDays: number;
  reservedDays: number;
  credits: CompTimeCredit[];
};

export function CompTimeAdminPanel({ user, employees, isManager }: { user: User; employees: Employee[]; isManager: boolean }) {
  const [targetEmpId, setTargetEmpId] = useState(user.empId);
  const [summary, setSummary] = useState<CompTimeSummary | null>(null);
  const [workDate, setWorkDate] = useState(todayDate());
  const [grantedDays, setGrantedDays] = useState(1);
  const [reason, setReason] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load(empId = targetEmpId) {
    try {
      const path = isManager && empId !== user.empId ? `/comp-time/manage?empId=${empId}` : "/comp-time/me";
      setSummary(await api<CompTimeSummary>(path));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "대체휴무 원장을 불러오지 못했습니다.");
    }
  }

  useEffect(() => { void load(targetEmpId); }, [targetEmpId]);

  async function grant(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await api("/comp-time/credits", {
        method: "POST",
        body: jsonBody({ empId: targetEmpId, workDate, grantedDays, reason, expiresOn: expiresOn || null })
      });
      setMessage("대체휴무를 적립하고 대상 직원에게 알림을 보냈습니다.");
      setReason("");
      setExpiresOn("");
      await load(targetEmpId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "대체휴무를 적립하지 못했습니다.");
    }
  }

  async function extend(credit: CompTimeCredit) {
    const next = window.prompt("새 만료일(YYYY-MM-DD)을 입력하세요.", credit.expiresOn)?.trim();
    if (!next) return;
    const extensionReason = window.prompt("만료일 연장 사유를 입력하세요.")?.trim();
    if (!extensionReason) return;
    try {
      await api(`/comp-time/credits/${credit.creditId}/expiry`, {
        method: "PUT",
        body: jsonBody({ expiresOn: next, reason: extensionReason })
      });
      setMessage("만료일을 연장하고 대상 직원에게 알림을 보냈습니다.");
      setError("");
      await load(targetEmpId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "만료일을 연장하지 못했습니다.");
    }
  }

  return <div className="approval-template-editor comp-time-admin">
    <div className="panel-head"><div><h3><CalendarClock size={18} /> 대체휴무 적립 원장</h3><p className="muted-text">만료일이 가까운 적립 건부터 자동 사용되며, 승인 휴가 취소 시 원 적립 건으로 복원됩니다.</p></div><button type="button" className="ghost" onClick={() => void load()}><RefreshCw size={16} /> 새로고침</button></div>
    {isManager && <label>조회 직원<select value={targetEmpId} onChange={(event) => setTargetEmpId(Number(event.target.value))}>{employees.map((employee) => <option key={employee.empId} value={employee.empId}>{employee.empName} · {employee.empNo}</option>)}</select></label>}
    {summary && <div className="template-note"><strong>{summary.empName} 대체휴무</strong><span>사용 가능 {summary.availableDays}일 · 결재 중 예약 {summary.reservedDays}일</span></div>}
    {message && <p className="template-note"><span>{message}</span></p>}{error && <p className="error">{error}</p>}
    {isManager && <form className="template-form holiday-form" onSubmit={grant}>
      <label>근무일<input required type="date" max={todayDate()} value={workDate} onChange={(event) => setWorkDate(event.target.value)} /></label>
      <label>적립일수<select value={grantedDays} onChange={(event) => setGrantedDays(Number(event.target.value))}><option value={1}>1일</option><option value={0.5}>0.5일</option></select></label>
      <label>만료일<input type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} /><small>비워두면 근무일 다음 달 말일</small></label>
      <label className="wide">적립 사유<input required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      <div className="actions wide"><button type="submit"><Plus size={16} /> 적립</button></div>
    </form>}
    <div className="table-wrap"><table><thead><tr><th>근무일</th><th>적립/잔여</th><th>사용 상태</th><th>만료일</th><th>사유/부여자</th>{isManager && <th>관리</th>}</tr></thead><tbody>{summary?.credits.map((credit) => <tr key={credit.creditId}><td>{credit.workDate}</td><td>{credit.grantedDays}일<small>잔여 {credit.availableDays}일</small></td><td>{credit.status === "ACTIVE" ? "사용 가능" : credit.status === "EXPIRED" ? "만료" : "소진"}<small>예약 {credit.reservedDays} · 사용 {credit.usedDays}</small></td><td>{credit.expiresOn}</td><td>{credit.reason}<small>{credit.grantedByName}</small></td>{isManager && <td><button type="button" className="ghost" onClick={() => void extend(credit)}>만료 연장</button></td>}</tr>)}</tbody></table></div>
  </div>;
}
