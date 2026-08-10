import { useEffect, useState } from "react";
import { Calculator, RefreshCw, Save } from "lucide-react";
import { api, jsonBody } from "../api";

type AnnualLeaveRow = {
  empId: number; empName: string; deptName: string | null; leaveYear: number;
  autoCalculatedDays: string; finalDays: string; calculationMode: "AUTO" | "MANUAL";
  confirmationStatus: "CONFIRMED" | "CONTRACT_CONFIRM_REQUIRED" | "LEAVE_CONFIRM_REQUIRED";
  calculationBasis: string | null; adjustmentReason: string | null;
};

export function AnnualLeaveAdminPanel() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<AnnualLeaveRow[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load(targetYear = year) {
    try { setRows(await api<AnnualLeaveRow[]>(`/annual-leaves?year=${targetYear}`)); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "연차 현황을 불러오지 못했습니다."); }
  }
  useEffect(() => { void load(); }, []);
  async function recalculate(row: AnnualLeaveRow) {
    try { await api(`/annual-leaves/${row.empId}/recalculate?year=${year}`, { method: "POST" }); setMessage(`${row.empName}님의 ${year}년 연차를 자동 재계산했습니다.`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "재계산하지 못했습니다."); }
  }
  async function finalize(row: AnnualLeaveRow) {
    const raw = window.prompt(`${row.empName}님의 ${year}년 최종 연차 수량`, row.finalDays); if (raw == null) return;
    const finalDays = Number(raw); if (!Number.isFinite(finalDays) || finalDays < 0 || finalDays > 30 || finalDays * 2 % 1 !== 0) { setError("0~30 범위에서 0.5일 단위로 입력해 주세요."); return; }
    const reason = window.prompt("수동 확정 사유를 입력하세요.", row.confirmationStatus === "CONTRACT_CONFIRM_REQUIRED" ? "계약조건 확인 후 확정" : "인사총무 최종 확인")?.trim(); if (!reason) return;
    try { await api("/annual-leaves", { method: "PUT", body: jsonBody({ empId: row.empId, leaveYear: year, finalDays, reason }) }); setMessage(`${row.empName}님의 최종 연차를 ${finalDays}일로 확정했습니다.`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "최종 연차를 확정하지 못했습니다."); }
  }
  return <div className="approval-template-editor annual-leave-admin"><div className="panel-head"><div><h3><Calculator size={18} /> 연차 관리</h3><p className="muted-text">1월 1일 자동 계산값을 확인하고 예외 직원만 최종 수량을 수동 확정합니다.</p></div><div className="actions"><input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} /><button className="ghost" onClick={() => void load()}><RefreshCw size={16} /> 조회</button></div></div>
    {message && <p className="template-note"><span>{message}</span></p>}{error && <p className="error">{error}</p>}
    <div className="table-wrap"><table><thead><tr><th>직원</th><th>자동 계산</th><th>최종 연차</th><th>상태</th><th>계산 근거</th><th>관리</th></tr></thead><tbody>{rows.map((row) => <tr key={row.empId}><td><strong>{row.empName}</strong><small>{row.deptName ?? "-"}</small></td><td>{row.autoCalculatedDays}일</td><td><strong>{row.finalDays}일</strong><small>{row.calculationMode === "MANUAL" ? `수동 · ${row.adjustmentReason ?? "-"}` : "자동"}</small></td><td><span className={`status-chip ${row.confirmationStatus === "CONFIRMED" ? "active" : "on_leave"}`}>{row.confirmationStatus === "CONFIRMED" ? "확정" : "최종 확인 필요"}</span></td><td className="annual-basis">{row.calculationBasis ?? "-"}</td><td><div className="actions"><button className="ghost" onClick={() => void recalculate(row)}><RefreshCw size={15} /> 자동계산</button><button onClick={() => void finalize(row)}><Save size={15} /> 최종확정</button></div></td></tr>)}</tbody></table></div>
  </div>;
}
