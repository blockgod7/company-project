import { useEffect, useState } from "react";
import { api, jsonBody } from "../api";

type AdminCase = { approvalId: number; sickPayType: "PAID" | "UNPAID"; sickPayReason: string | null; workersCompStatus: string; workersCompReason: string | null };

export function LeaveAdminCasePanel({ approvalId, leaveTypes }: { approvalId: number; leaveTypes: string[] }) {
  const [value, setValue] = useState<AdminCase | null>(null);
  const [error, setError] = useState("");
  const hasSick = leaveTypes.includes("병가");
  const hasComp = leaveTypes.includes("산재요양");
  async function load() { try { setValue(await api<AdminCase>(`/leave-admin-cases/${approvalId}`)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "관리 상태를 불러오지 못했습니다."); } }
  useEffect(() => { if (hasSick || hasComp) void load(); }, [approvalId]);
  if (!hasSick && !hasComp) return null;
  async function sick(paid: boolean) { const reason=window.prompt(`병가를 ${paid ? "유급" : "무급"}으로 처리하는 사유를 입력하세요.`)?.trim(); if(!reason)return; try{setValue(await api<AdminCase>(`/leave-admin-cases/${approvalId}/sick-pay`,{method:"PUT",body:jsonBody({paid,reason})}));}catch(e){setError(e instanceof Error?e.message:"변경하지 못했습니다.");} }
  async function comp(status: string) { const reason=window.prompt("산재 상태 변경 사유를 입력하세요.")?.trim(); if(!reason)return; try{setValue(await api<AdminCase>(`/leave-admin-cases/${approvalId}/workers-comp`,{method:"PUT",body:jsonBody({status,reason})}));}catch(e){setError(e instanceof Error?e.message:"변경하지 못했습니다.");} }
  return <section className="approval-detail-section"><h3>휴가관리자 처리</h3>{error&&<p className="error">{error}</p>}{hasSick&&<div className="template-note"><strong>병가 급여: {value?.sickPayType==="PAID"?"유급":"무급"}</strong><span>{value?.sickPayReason??"기본 무급"}</span><div className="actions"><button type="button" onClick={()=>void sick(true)}>유급 전환</button><button type="button" className="ghost" onClick={()=>void sick(false)}>무급 전환</button></div></div>}{hasComp&&<div className="template-note"><strong>산재 상태: {value?.workersCompStatus??"BEFORE_SUBMISSION"}</strong><span>{value?.workersCompReason??"상태 이력 없음"}</span><div className="actions">{["BEFORE_SUBMISSION","SUBMITTED","APPROVED","REJECTED"].map(status=><button type="button" className="ghost" key={status} onClick={()=>void comp(status)}>{status}</button>)}</div></div>}</section>;
}
