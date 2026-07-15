import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardPlus, History, Plus, Send, Upload, Wrench } from "lucide-react";
import { api, authenticatedFetch, jsonBody } from "../api";
import { EmployeeMultiPicker } from "../components/EmployeePickers";
import type { DeptNode, Employee, Equipment, EquipmentAssignmentAuthority, EquipmentAssignmentPermission, EquipmentHistoryEvent, EquipmentProcess, EquipmentReport, PageResponse, User } from "../types";

const today = () => new Date().toISOString().slice(0, 10);
const flattenDepts = (nodes: DeptNode[]): DeptNode[] => nodes.flatMap((node) => [node, ...flattenDepts(node.children)]);
const emptyReport = () => ({ equipmentId: "", title: "", symptom: "", requestContent: "", priority: "NORMAL", occurredOn: today(), approverEmpIds: [] as number[] });
const emptyEquipment = () => ({ equipmentNo: "", equipmentName: "", location: "", equipmentType: "GENERAL", assetNo: "", processId: "", ownerDeptId: "", modelName: "", introducedYear: "", introducedPrice: "", manufacturer: "", status: "IN_USE" });

export function EquipmentManagementPage({ user, isAdmin }: { user: User; isAdmin: boolean }) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [reports, setReports] = useState<EquipmentReport[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [processes, setProcesses] = useState<EquipmentProcess[]>([]);
  const [deptTree, setDeptTree] = useState<DeptNode[]>([]);
  const [selected, setSelected] = useState<EquipmentReport | null>(null);
  const [history, setHistory] = useState<EquipmentHistoryEvent[]>([]);
  const [reportForm, setReportForm] = useState(emptyReport);
  const [equipmentForm, setEquipmentForm] = useState(emptyEquipment);
  const [editingEquipmentId, setEditingEquipmentId] = useState<number | null>(null);
  const [masterFormOpen, setMasterFormOpen] = useState(false);
  const [tab, setTab] = useState<"MASTER" | "REPORTS" | "HISTORY">("MASTER");
  const [reportView, setReportView] = useState<"CREATE" | "WORK" | "STATUS">("CREATE");
  const [masterSearch, setMasterSearch] = useState("");
  const [masterStatus, setMasterStatus] = useState("");
  const [detailEquipment, setDetailEquipment] = useState<Equipment | null>(null);
  const [processName, setProcessName] = useState("");
  const [assignment, setAssignment] = useState({ assigneeEmpId: "", plannedStartOn: today(), plannedEndOn: today(), instruction: "" });
  const [completion, setCompletion] = useState({ workResult: "", causeAnalysis: "", actionTaken: "", completedOn: today(), workDurationHours: "", approverEmpIds: [] as number[] });
  const [assignmentPermission, setAssignmentPermission] = useState<EquipmentAssignmentPermission>({ canAssign: false, canManageAssignmentAuthorities: false });
  const [assignmentAuthorities, setAssignmentAuthorities] = useState<EquipmentAssignmentAuthority[]>([]);
  const [authorityCandidateIds, setAuthorityCandidateIds] = useState<number[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canAssign = assignmentPermission.canAssign;

  async function load() {
    try {
      const [nextEquipment, nextReports, employeePage, nextProcesses, nextDeptTree, nextPermission] = await Promise.all([
        api<Equipment[]>("/equipment"),
        api<EquipmentReport[]>("/equipment/reports"),
        api<PageResponse<Employee>>("/emps?page=0&size=100&status=ACTIVE"),
        api<EquipmentProcess[]>("/equipment/processes"),
        api<DeptNode[]>("/depts/tree"), api<EquipmentAssignmentPermission>("/equipment/assignment-permission")
      ]);
      setEquipment(nextEquipment); setReports(nextReports); setEmployees(employeePage.content); setProcesses(nextProcesses); setDeptTree(nextDeptTree); setAssignmentPermission(nextPermission);
      if (nextPermission.canManageAssignmentAuthorities) setAssignmentAuthorities(await api<EquipmentAssignmentAuthority[]>("/equipment/assignment-authorities")); else setAssignmentAuthorities([]);
      if (selected) setSelected(nextReports.find((item) => item.reportId === selected.reportId) ?? null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "설비관리 데이터를 불러오지 못했습니다."); }
  }

  useEffect(() => { void load(); }, []);

  async function openReport(report: EquipmentReport) {
    setSelected(report); setError(""); setMessage("");
    try { setHistory(await api<EquipmentHistoryEvent[]>(`/equipment/${report.equipmentId}/history`)); }
    catch { setHistory([]); }
  }

  async function submitReport(event: React.FormEvent) {
    event.preventDefault(); setError("");
    try {
      const created = await api<EquipmentReport>("/equipment/reports", { method: "POST", body: jsonBody({ ...reportForm, equipmentId: Number(reportForm.equipmentId) }) });
      setReportForm(emptyReport()); setMessage("이상보고를 등록하고 부서장 결재를 요청했습니다."); await load(); await openReport(created);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "이상보고 등록에 실패했습니다."); }
  }

  async function submitEquipment(event: React.FormEvent) {
    event.preventDefault();
    try { const payload = { ...equipmentForm, processId: Number(equipmentForm.processId), ownerDeptId: equipmentForm.equipmentType === "UTILITY" ? null : Number(equipmentForm.ownerDeptId), introducedYear: equipmentForm.introducedYear ? Number(equipmentForm.introducedYear) : null, introducedPrice: equipmentForm.introducedPrice ? Number(equipmentForm.introducedPrice) : null }; await api<Equipment>(editingEquipmentId ? `/equipment/${editingEquipmentId}` : "/equipment", { method: editingEquipmentId ? "PUT" : "POST", body: jsonBody(payload) }); setMasterFormOpen(false); setEditingEquipmentId(null); setEquipmentForm(emptyEquipment()); setMessage(editingEquipmentId ? "설비대장을 수정했습니다." : "설비대장을 등록했습니다."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "설비 등록에 실패했습니다."); }
  }

  async function createProcess() {
    const name = processName.trim();
    if (!name) return;
    try { await api<EquipmentProcess>("/equipment/processes", { method: "POST", body: jsonBody({ processName: name }) }); setProcessName(""); setMessage("공정을 등록했습니다."); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "공정 등록에 실패했습니다."); }
  }

  async function assignWork(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return;
    try {
      await api<EquipmentReport>(`/equipment/reports/${selected.reportId}/assign`, { method: "POST", body: jsonBody({ ...assignment, assigneeEmpId: Number(assignment.assigneeEmpId) }) });
      setMessage("보전 담당자에게 작업을 배분했습니다."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "작업 배분에 실패했습니다."); }
  }

  async function submitCompletion(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return;
    try {
      await api<EquipmentReport>(`/equipment/reports/${selected.reportId}/complete`, { method: "POST", body: jsonBody(completion) });
      setMessage("작업결과를 등록하고 완료 결재를 요청했습니다."); setCompletion({ workResult: "", causeAnalysis: "", actionTaken: "", completedOn: today(), workDurationHours: "", approverEmpIds: [] }); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "작업완료 상신에 실패했습니다."); }
  }

  async function grantAssignmentAuthority() { if (!authorityCandidateIds[0]) return; try { await api<EquipmentAssignmentAuthority>("/equipment/assignment-authorities", { method: "POST", body: jsonBody({ empId: authorityCandidateIds[0] }) }); setAuthorityCandidateIds([]); setMessage("배분 권한을 부여했습니다."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "권한 부여에 실패했습니다."); } }
  async function revokeAssignmentAuthority(authorityId: number) { try { await api<void>(`/equipment/assignment-authorities/${authorityId}`, { method: "DELETE" }); setMessage("배분 권한을 회수했습니다."); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "권한 회수에 실패했습니다."); } }

  async function uploadAttachment(file: File) {
    if (!selected) return;
    const body = new FormData(); body.set("targetType", "EQUIPMENT_REPORT"); body.set("targetId", String(selected.reportId)); body.set("file", file);
    try {
      const response = await authenticatedFetch("/files", { method: "POST", body });
      if (!response.ok) throw new Error("첨부파일 업로드에 실패했습니다.");
      setMessage("첨부파일을 추가했습니다.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "첨부파일 업로드에 실패했습니다."); }
  }

  const selectedCurrent = selected && reports.find((item) => item.reportId === selected.reportId) || selected;
  const filteredEquipment = equipment.filter((item) => (!masterStatus || item.status === masterStatus) && `${item.equipmentNo} ${item.equipmentName} ${item.assetNo}`.toLowerCase().includes(masterSearch.toLowerCase()));
  const reportEquipment = equipment.find((item) => item.equipmentId === Number(reportForm.equipmentId));
  function editEquipment(item: Equipment) { setMasterFormOpen(true); setEditingEquipmentId(item.equipmentId); setEquipmentForm({ equipmentNo: item.equipmentNo, equipmentName: item.equipmentName, location: item.processName ?? "", equipmentType: item.equipmentType, assetNo: item.assetNo, processId: String(item.processId ?? ""), ownerDeptId: String(item.ownerDeptId ?? ""), modelName: item.modelName ?? "", introducedYear: item.introducedYear ? String(item.introducedYear) : "", introducedPrice: item.introducedPrice ? String(item.introducedPrice) : "", manufacturer: item.manufacturer ?? "", status: item.status }); }
  function closeMasterForm() { setMasterFormOpen(false); setEditingEquipmentId(null); setEquipmentForm(emptyEquipment()); }
  const assignedToMe = selectedCurrent?.assigneeEmpId === user.empId;

  return <div className={`equipment-page equipment-tab-${tab.toLowerCase()} ${masterFormOpen ? "master-form-open" : "master-form-closed"}`}>
    {(message || error) && <div className={error ? "equipment-alert error" : "equipment-alert"}>{error || message}</div>}
    <div className="equipment-tab-toolbar"><div className="board-tabs"><button className={tab === "MASTER" ? "active" : ""} onClick={() => setTab("MASTER")}>설비관리대장</button><button className={tab === "REPORTS" ? "active" : ""} onClick={() => setTab("REPORTS")}>설비이상보고</button><button className={tab === "HISTORY" ? "active" : ""} onClick={() => setTab("HISTORY")}>설비이력</button></div>{isAdmin && tab === "MASTER" && <div className="toolbar-actions"><input value={processName} onChange={(e) => setProcessName(e.target.value)} placeholder="새 공정명" /><button type="button" onClick={() => void createProcess()}>+ 공정 등록</button><button className="primary-action" type="button" onClick={() => { if (masterFormOpen) closeMasterForm(); else setMasterFormOpen(true); }}>{masterFormOpen ? "작성창 닫기" : "+ 설비관리대장 등록"}</button></div>}</div>
    <div className="equipment-layout">
      <section className="equipment-main">
        {tab === "MASTER" && <div className="equipment-card"><div className="panel-head"><h2>설비관리대장</h2><span>{filteredEquipment.length}건</span></div><div className="equipment-form"><label className="wide">검색<input value={masterSearch} onChange={(e) => setMasterSearch(e.target.value)} placeholder="설비번호, 설비명, 자산번호" /></label><label>상태<select value={masterStatus} onChange={(e) => setMasterStatus(e.target.value)}><option value="">전체</option><option value="IN_USE">사용중</option><option value="RENTED">임대</option><option value="DISPOSED">폐기</option><option value="LONG_TERM_STORAGE">장기보관</option></select></label></div><div className="table-wrap"><table className="content-table"><thead><tr><th>설비번호</th><th>설비명</th><th>구분</th><th>사업부</th><th>공정</th><th>자산번호</th><th>상태</th><th>관리</th></tr></thead><tbody>{filteredEquipment.map((item) => <tr key={item.equipmentId}><td>{item.equipmentNo}</td><td>{item.equipmentName}</td><td>{item.equipmentType === "UTILITY" ? "유틸리티" : "일반"}</td><td>{item.equipmentType === "UTILITY" ? "공용" : item.ownerDeptName ?? "-"}</td><td>{item.processName ?? "-"}</td><td>{item.assetNo}</td><td>{statusLabel(item.status)}</td><td><div className="equipment-row-actions"><button type="button" className="ghost" onClick={() => setDetailEquipment(item)}>상세</button><button type="button" className="ghost" onClick={() => editEquipment(item)}>수정</button></div></td></tr>)}</tbody></table></div></div>}
        {tab === "HISTORY" && <div className="equipment-card"><div className="panel-head"><h2>설비이력</h2><span>이상보고를 선택하면 상세 이력을 봅니다.</span></div><div className="equipment-report-list">{reports.map((report) => <button type="button" className="equipment-report" key={report.reportId} onClick={() => void openReport(report)}><strong>{report.equipmentName} · {report.title}</strong><span>{stateLabel(report.state)} · {report.createdAt.slice(0, 10)}</span></button>)}</div></div>}
        {tab === "REPORTS" && <>
        <div className="board-tabs equipment-report-tabs"><button className={reportView === "CREATE" ? "active" : ""} onClick={() => setReportView("CREATE")}>신규 등록</button><button className={reportView === "WORK" ? "active" : ""} onClick={() => setReportView("WORK")}>작업 처리</button><button className={reportView === "STATUS" ? "active" : ""} onClick={() => setReportView("STATUS")}>진행 조회</button></div>
        {reportView === "CREATE" &&
        <div className="equipment-card">
          <div className="panel-head"><h2><ClipboardPlus size={19} /> 이상보고 등록</h2><span>모든 로그인 사용자</span></div>
          <form className="equipment-form" onSubmit={submitReport}>
            <label>설비<select required value={reportForm.equipmentId} onChange={(e) => setReportForm({ ...reportForm, equipmentId: e.target.value })}><option value="">설비를 선택하세요</option>{equipment.map((item) => <option key={item.equipmentId} value={item.equipmentId}>{item.equipmentName}</option>)}</select></label>
            <label>사업부<input value={reportEquipment ? (reportEquipment.equipmentType === "UTILITY" ? "공용" : reportEquipment.ownerDeptName ?? "-") : "설비를 선택하세요"} readOnly /></label>
            <label>발생일<input type="date" value={reportForm.occurredOn} onChange={(e) => setReportForm({ ...reportForm, occurredOn: e.target.value })} /></label>
            <label>우선순위<select value={reportForm.priority} onChange={(e) => setReportForm({ ...reportForm, priority: e.target.value })}><option value="NORMAL">일반</option><option value="IMPORTANT">중요</option><option value="URGENT">긴급</option></select></label>
            <label className="wide">제목<input required value={reportForm.title} onChange={(e) => setReportForm({ ...reportForm, title: e.target.value })} placeholder="예: 1호기 구동부 이상" /></label>
            <label className="wide">이상 증상<textarea required value={reportForm.symptom} onChange={(e) => setReportForm({ ...reportForm, symptom: e.target.value })} /></label>
            <label className="wide">요청 내용<textarea required value={reportForm.requestContent} onChange={(e) => setReportForm({ ...reportForm, requestContent: e.target.value })} /></label>
            <div className="wide"><EmployeeMultiPicker title="결재자" user={user} employees={employees} selectedIds={reportForm.approverEmpIds} disabledIds={[user.empId]} ordered onChange={(approverEmpIds) => setReportForm({ ...reportForm, approverEmpIds })} /></div>
            <button className="primary wide" type="submit"><Send size={16} /> 결재 요청</button>
          </form>
        </div>
        }
        {reportView !== "CREATE" && <div className="equipment-card"><div className="panel-head"><h2><Wrench size={19} /> {reportView === "WORK" ? "작업 처리 대상" : "진행 중인 이상보고"}</h2><button type="button" onClick={() => void load()}>새로고침</button></div>
          <div className="equipment-report-list">{reports.map((report) => <button type="button" className={selectedCurrent?.reportId === report.reportId ? "equipment-report active" : "equipment-report"} key={report.reportId} onClick={() => void openReport(report)}><span className={`equipment-state ${report.state.toLowerCase()}`}>{stateLabel(report.state)}</span><strong>{report.title}</strong><span>{report.equipmentName} · {report.reporterName} · {report.createdAt.slice(0, 10)}</span></button>)}{!reports.length && <p className="empty-copy">등록된 이상보고가 없습니다.</p>}</div>
        </div>}
        </>}
      </section>
      <aside className="equipment-side">
        {tab !== "MASTER" && reportView === "WORK" && (selectedCurrent ? <ReportDetail report={selectedCurrent} user={user} canAssign={canAssign} employees={employees} assignment={assignment} setAssignment={setAssignment} completion={completion} setCompletion={setCompletion} history={history} onAssign={assignWork} onComplete={submitCompletion} onUpload={uploadAttachment} /> : <div className="equipment-card"><History size={28} /><h2>보고서를 선택하세요</h2><p>배분 또는 작업완료 처리할 보고서를 선택하세요.</p></div>)}
        {tab === "REPORTS" && reportView === "WORK" && assignmentPermission.canManageAssignmentAuthorities && <div className="equipment-card"><div className="panel-head"><h2>배분 권한 관리</h2><span>생산기술팀장</span></div><EmployeeMultiPicker title="권한 부여 대상" user={user} employees={employees} selectedIds={authorityCandidateIds} disabledIds={assignmentAuthorities.map((item) => item.empId)} onChange={(ids) => setAuthorityCandidateIds(ids.slice(-1))} /><button type="button" className="primary" onClick={() => void grantAssignmentAuthority()} disabled={!authorityCandidateIds.length}>권한 부여</button><div className="equipment-report-list">{assignmentAuthorities.map((item) => <div className="selected-approver" key={item.authorityId}><strong>{item.empName}</strong><span>{item.deptName ?? "-"} · 부여자 {item.grantedByName}</span><button type="button" className="ghost" onClick={() => void revokeAssignmentAuthority(item.authorityId)}>권한 회수</button></div>)}</div></div>}
        {isAdmin && tab === "MASTER" && <div className="equipment-card"><div className="panel-head"><h2><Plus size={18} /> {editingEquipmentId ? "설비대장 수정" : "설비대장 등록"}</h2><span>관리자</span></div><form className="equipment-form compact" onSubmit={submitEquipment}><label>설비번호<input required value={equipmentForm.equipmentNo} onChange={(e) => setEquipmentForm({ ...equipmentForm, equipmentNo: e.target.value })} /></label><label>설비명<input required value={equipmentForm.equipmentName} onChange={(e) => setEquipmentForm({ ...equipmentForm, equipmentName: e.target.value })} /></label><label>자산번호<input required value={equipmentForm.assetNo} onChange={(e) => setEquipmentForm({ ...equipmentForm, assetNo: e.target.value })} /></label><label>설비구분<select value={equipmentForm.equipmentType} onChange={(e) => setEquipmentForm({ ...equipmentForm, equipmentType: e.target.value })}><option value="GENERAL">일반설비</option><option value="UTILITY">유틸리티</option></select></label><label>공정<select required value={equipmentForm.processId} onChange={(e) => setEquipmentForm({ ...equipmentForm, processId: e.target.value })}><option value="">선택</option>{processes.map((item) => <option key={item.processId} value={item.processId}>{item.processName}</option>)}</select></label><label>사업부{equipmentForm.equipmentType === "UTILITY" ? <input value="공용" disabled /> : <select required value={equipmentForm.ownerDeptId} onChange={(e) => setEquipmentForm({ ...equipmentForm, ownerDeptId: e.target.value })}><option value="">선택</option>{flattenDepts(deptTree).map((item) => <option key={item.deptId} value={item.deptId}>{item.deptName}</option>)}</select>}</label><label>상태<select value={equipmentForm.status} onChange={(e) => setEquipmentForm({ ...equipmentForm, status: e.target.value })}><option value="IN_USE">사용중</option><option value="RENTED">임대</option><option value="DISPOSED">폐기</option><option value="LONG_TERM_STORAGE">장기보관</option></select></label><label>모델명<input value={equipmentForm.modelName} onChange={(e) => setEquipmentForm({ ...equipmentForm, modelName: e.target.value })} /></label><label>도입년도<input type="number" value={equipmentForm.introducedYear} onChange={(e) => setEquipmentForm({ ...equipmentForm, introducedYear: e.target.value })} /></label><label>도입가격<input type="number" value={equipmentForm.introducedPrice} onChange={(e) => setEquipmentForm({ ...equipmentForm, introducedPrice: e.target.value })} /></label><label>제조회사<input value={equipmentForm.manufacturer} onChange={(e) => setEquipmentForm({ ...equipmentForm, manufacturer: e.target.value })} /></label><div className="equipment-form-actions"><button type="button" className="ghost" onClick={closeMasterForm}>취소</button><button className="primary" type="submit">{editingEquipmentId ? "수정 저장" : "설비 등록"}</button></div></form></div>}
      </aside>
    </div>
    {detailEquipment && <div className="equipment-detail-backdrop" role="presentation" onClick={() => setDetailEquipment(null)}><section className="equipment-card equipment-detail-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}><div className="panel-head"><h2>{detailEquipment.equipmentName}</h2><button type="button" className="ghost" onClick={() => setDetailEquipment(null)}>닫기</button></div><dl><div><dt>설비번호</dt><dd>{detailEquipment.equipmentNo}</dd></div><div><dt>구분</dt><dd>{detailEquipment.equipmentType === "UTILITY" ? "유틸리티" : "일반설비"}</dd></div><div><dt>사업부</dt><dd>{detailEquipment.equipmentType === "UTILITY" ? "공용" : detailEquipment.ownerDeptName ?? "-"}</dd></div><div><dt>공정</dt><dd>{detailEquipment.processName ?? "-"}</dd></div><div><dt>자산번호</dt><dd>{detailEquipment.assetNo}</dd></div><div><dt>모델명</dt><dd>{detailEquipment.modelName ?? "-"}</dd></div><div><dt>제조회사</dt><dd>{detailEquipment.manufacturer ?? "-"}</dd></div><div><dt>도입년도</dt><dd>{detailEquipment.introducedYear ?? "-"}</dd></div><div><dt>도입가격</dt><dd>{detailEquipment.introducedPrice?.toLocaleString() ?? "-"}</dd></div><div><dt>상태</dt><dd>{statusLabel(detailEquipment.status)}</dd></div></dl></section></div>}
  </div>;
}

function ReportDetail({ report, user, canAssign, employees, assignment, setAssignment, completion, setCompletion, history, onAssign, onComplete, onUpload }: { report: EquipmentReport; user: User; canAssign: boolean; employees: Employee[]; assignment: { assigneeEmpId: string; plannedStartOn: string; plannedEndOn: string; instruction: string }; setAssignment: (value: { assigneeEmpId: string; plannedStartOn: string; plannedEndOn: string; instruction: string }) => void; completion: { workResult: string; causeAnalysis: string; actionTaken: string; completedOn: string; workDurationHours: string; approverEmpIds: number[] }; setCompletion: (value: { workResult: string; causeAnalysis: string; actionTaken: string; completedOn: string; workDurationHours: string; approverEmpIds: number[] }) => void; history: EquipmentHistoryEvent[]; onAssign: (event: React.FormEvent) => Promise<void>; onComplete: (event: React.FormEvent) => Promise<void>; onUpload: (file: File) => Promise<void> }) {
  return <div className="equipment-card report-detail"><div className="panel-head"><h2>{report.title}</h2><span className={`equipment-state ${report.state.toLowerCase()}`}>{stateLabel(report.state)}</span></div><dl><div><dt>설비</dt><dd>{report.equipmentNo} · {report.equipmentName}</dd></div><div><dt>신고자</dt><dd>{report.reporterName}</dd></div><div><dt>증상</dt><dd>{report.symptom}</dd></div><div><dt>요청</dt><dd>{report.requestContent}</dd></div></dl><label className="file-upload"><Upload size={15} /> 선택 첨부<input type="file" onChange={(e) => e.target.files?.[0] && void onUpload(e.target.files[0])} /></label>
    {report.state === "ASSIGNMENT_PENDING" && canAssign && <form className="equipment-form compact" onSubmit={(e) => void onAssign(e)}><h3>작업 배분</h3><label>보전 담당자<select required value={assignment.assigneeEmpId} onChange={(e) => setAssignment({ ...assignment, assigneeEmpId: e.target.value })}><option value="">선택</option>{employees.map((employee) => <option value={employee.empId} key={employee.empId}>{employee.empName} · {employee.deptName}</option>)}</select></label><label>시작일<input type="date" value={assignment.plannedStartOn} onChange={(e) => setAssignment({ ...assignment, plannedStartOn: e.target.value })} /></label><label>종료일<input type="date" value={assignment.plannedEndOn} onChange={(e) => setAssignment({ ...assignment, plannedEndOn: e.target.value })} /></label><label>작업지시<textarea value={assignment.instruction} onChange={(e) => setAssignment({ ...assignment, instruction: e.target.value })} /></label><button className="primary" type="submit">작업 배분</button></form>}
    {(report.state === "IN_PROGRESS" || report.state === "REWORK") && report.assigneeEmpId === user.empId && <form className="equipment-form compact" onSubmit={(e) => void onComplete(e)}><h3>작업완료 보고</h3><label>완료 일자<input required type="date" value={completion.completedOn} onChange={(e) => setCompletion({ ...completion, completedOn: e.target.value })} /></label><label>소요 시간(시간)<input required type="number" min="0.01" step="0.01" value={completion.workDurationHours} onChange={(e) => setCompletion({ ...completion, workDurationHours: e.target.value })} placeholder="예: 2.5" /></label><label>작업 결과<textarea required value={completion.workResult} onChange={(e) => setCompletion({ ...completion, workResult: e.target.value })} /></label><label>원인 분석<textarea value={completion.causeAnalysis} onChange={(e) => setCompletion({ ...completion, causeAnalysis: e.target.value })} /></label><label>조치 내용<textarea required value={completion.actionTaken} onChange={(e) => setCompletion({ ...completion, actionTaken: e.target.value })} /></label><button className="primary" type="submit"><CheckCircle2 size={16} /> 완료 결재 요청</button></form>}
    {(report.state === "IN_PROGRESS" || report.state === "REWORK") && report.assigneeEmpId === user.empId && <EmployeeMultiPicker title="완료 결재자" user={user} employees={employees} selectedIds={completion.approverEmpIds} disabledIds={[user.empId]} ordered onChange={(approverEmpIds) => setCompletion({ ...completion, approverEmpIds })} />}
    <div className="equipment-history"><h3>설비 이력</h3>{history.filter((item) => item.reportId === report.reportId).map((item) => <div key={item.eventId}><strong>{item.eventType}</strong><span>{item.message}</span><small>{item.createdAt.slice(0, 16).replace("T", " ")}</small></div>)}</div></div>;
}

function stateLabel(value: string) { return ({ PENDING_INITIAL_APPROVAL: "최초 결재 대기", ASSIGNMENT_PENDING: "배분 대기", IN_PROGRESS: "작업 진행", PENDING_COMPLETION_APPROVAL: "완료 결재 대기", REWORK: "재작업", COMPLETED: "완료", REJECTED: "반려" } as Record<string, string>)[value] ?? value; }
function statusLabel(value: string) { return ({ IN_USE: "사용중", RENTED: "임대", DISPOSED: "폐기", LONG_TERM_STORAGE: "장기보관" } as Record<string, string>)[value] ?? value; }
