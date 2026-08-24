import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import type { Approval, Employee, User, WorkSchedule } from "../types";
import { approvalDraftData, type ApprovalForm } from "../utils/approvalDomain";

type WorkRow = { empId: number; empName?: string; deptName?: string | null; workType: "OVERTIME" | "SPECIAL" | "EMERGENCY_CALL"; workDate: string; startTime: string; endTime: string; workContent: string; compTime: boolean };
type ChangeRow = { sourceWorkEntryId: number; actionType: "CANCEL" | "CHANGE"; reason: string; newWorkDate: string; newStartTime: string; newEndTime: string; newWorkContent: string; newCompTime: boolean };

const today = () => new Date().toISOString().slice(0, 10);
const defaultWorkTimes = (workType: WorkRow["workType"]) => workType === "OVERTIME"
  ? { startTime: "18:00", endTime: "20:00" }
  : workType === "SPECIAL" ? { startTime: "08:30", endTime: "17:30" } : { startTime: "08:00", endTime: "17:00" };
const blankWork = (empId: number, mode: "request" | "emergency" = "request", compTime = false): WorkRow => {
  const workType: WorkRow["workType"] = mode === "emergency" ? "EMERGENCY_CALL" : "SPECIAL";
  return { empId, workType, workDate: today(), ...defaultWorkTimes(workType), workContent: "", compTime: mode === "request" && compTime };
};
const blankChange = (source?: WorkSchedule): ChangeRow => ({ sourceWorkEntryId: source?.workEntryId ?? 0, actionType: "CANCEL", reason: "", newWorkDate: source?.workDate ?? today(), newStartTime: source?.startTime?.slice(0, 5) ?? "08:00", newEndTime: source?.endTime?.slice(0, 5) ?? "17:00", newWorkContent: source?.workContent ?? "", newCompTime: source?.compTime ?? false });

function parseRows<T>(value: string | undefined, fallback: T[]): T[] { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) && parsed.length ? parsed : fallback; } catch { return fallback; } }
function workTypeLabel(type: WorkSchedule["workType"]) { return type === "OVERTIME" ? "잔업" : type === "SPECIAL" ? "특근(주말·공휴일)" : "비상호출"; }
function statusLabel(status: WorkSchedule["status"]) { return status === "PLANNED" ? "근무 예정" : status === "COMPLETED" ? "근무 완료" : status === "CANCEL_PENDING" ? "취소 결재중" : status === "CANCELED" ? "취소" : "결재중"; }

export function WorkRequestEditor({ mode, user, form, headerActions, onChange }: { mode: "request" | "emergency" | "change"; user: User; form: ApprovalForm; headerActions?: ReactNode; onChange: (form: ApprovalForm) => void }) {
  const [candidates, setCandidates] = useState<Employee[]>([]);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [workerPickerOpen, setWorkerPickerOpen] = useState(false);
  const [workerPickerEmpId, setWorkerPickerEmpId] = useState<number | null>(null);
  const delegated = user.permissions.includes("WORK_REQUEST_DELEGATE") || user.roleCode === "ADMIN" || user.permissions.includes("FULL_ADMIN");
  useEffect(() => { void api<Employee[]>("/work-schedules/candidates").then(setCandidates).finally(() => setCandidatesLoaded(true)); }, []);
  useEffect(() => { if (mode === "change") void api<WorkSchedule[]>(`/work-schedules/changeable${delegated ? "?all=true" : ""}`).then(setSchedules); }, [mode, delegated]);
  const employees = candidates.length ? candidates : [{ empId: user.empId, empName: user.empName, deptId: user.deptId, deptName: user.deptName, workCategory: "FIELD" } as Employee];
  const requestMode = mode === "emergency" ? "emergency" : "request";
  const workRows = useMemo(() => parseRows<WorkRow>(form.fieldValues.workEntriesJson, [blankWork(user.empId, requestMode)]), [form.fieldValues.workEntriesJson, user.empId, requestMode]);
  const changeRows = useMemo(() => parseRows<ChangeRow>(form.fieldValues.workChangesJson, schedules[0] ? [blankChange(schedules[0])] : []), [form.fieldValues.workChangesJson, schedules]);
  const setWorkRows = (rows: WorkRow[]) => onChange({ ...form, fieldValues: { ...form.fieldValues, workEntriesJson: JSON.stringify(rows.map((row) => { const employee = employees.find((item) => item.empId === row.empId); return { ...row, empName: employee?.empName ?? row.empName, deptName: employee?.deptName ?? row.deptName }; })) } });
  const setChangeRows = (rows: ChangeRow[]) => onChange({ ...form, fieldValues: { ...form.fieldValues, workChangesJson: JSON.stringify(rows) } });
  useEffect(() => {
    if (mode !== "change" && candidatesLoaded && !form.fieldValues.workEntriesJson) {
      const requester = candidates.find((item) => item.empId === user.empId);
      setWorkRows([blankWork(user.empId, requestMode, requester?.workCategory === "MANAGEMENT")]);
    }
  }, [mode, candidates, candidatesLoaded, form.fieldValues.workEntriesJson, user.empId, requestMode]);
  useEffect(() => {
    if (mode === "change" && schedules[0] && !form.fieldValues.workChangesJson) setChangeRows([blankChange(schedules[0])]);
  }, [mode, schedules, form.fieldValues.workChangesJson]);
  const updateWork = (index: number, next: Partial<WorkRow>) => setWorkRows(workRows.map((row, i) => i === index ? { ...row, ...next } : row));
  const updateChange = (index: number, next: Partial<ChangeRow>) => setChangeRows(changeRows.map((row, i) => i === index ? { ...row, ...next } : row));
  const availableTypes = (employee?: Employee): WorkRow["workType"][] => mode === "emergency"
    ? ["EMERGENCY_CALL"]
    : employee?.workCategory === "MANAGEMENT" ? ["SPECIAL"] : ["OVERTIME", "SPECIAL"];
  const openWorkerPicker = () => {
    setWorkerPickerEmpId(null);
    setWorkerPickerOpen(true);
  };
  const addSelectedWorker = () => {
    if (workerPickerEmpId == null) return;
    const employee = employees.find((item) => item.empId === workerPickerEmpId);
    setWorkRows([...workRows, blankWork(workerPickerEmpId, requestMode, employee?.workCategory === "MANAGEMENT")]);
    setWorkerPickerOpen(false);
  };
  const canAddWorkers = delegated;
  const departmentTitle = user.deptName?.trim() || "소속 부서";
  const generatedTitle = mode === "emergency" ? departmentTitle + " 비상호출 신청서"
    : mode === "change" ? departmentTitle + " 근무 변경·취소계" : departmentTitle + " 근무 신청서";
  const automaticTitles = ["근무신청서", "비상호출 신청서", "근무 변경·취소계",
    departmentTitle + " 근무 신청서", departmentTitle + " 비상호출 신청서", departmentTitle + " 근무 변경·취소계"];
  useEffect(() => {
    if (!form.title.trim() || automaticTitles.includes(form.title)) onChange({ ...form, title: generatedTitle });
  }, [mode, departmentTitle]);

  const changeWorker = (index: number, empId: number) => {
    const employee = employees.find((item) => item.empId === empId);
    const types = availableTypes(employee);
    const current = workRows[index];
    const workType = types.includes(current.workType) ? current.workType : types[0];
    updateWork(index, {
      empId,
      workType,
      ...(workType === current.workType ? {} : defaultWorkTimes(workType)),
      compTime: workType === "SPECIAL" && employee?.workCategory === "MANAGEMENT"
    });
  };

  return <div className={"work-request-editor work-request-form " + mode}>
    <div className={"work-form-hero " + mode}>
      <label className="work-form-title">
        <span className="work-form-kicker">{mode === "change" ? "근무 변경·취소 신청" : mode === "emergency" ? "비상호출 근무 신청" : "잔업·특근 근무 신청"}</span>
        <span>문서 제목</span>
        <input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} />
      </label>
      {headerActions}
    </div>
    <div className="work-form-applicant">
      <div><span>신청부서</span><strong>{departmentTitle}</strong></div>
      <div><span>신청자</span><strong>{user.empName}</strong></div>
      <div><span>작성일</span><strong>{today()}</strong></div>
    </div>
    {mode !== "change" ? (
      <section className="work-form-section">
        {canAddWorkers && <div className="work-form-section-head">
          <div><h4>근무자별 신청 내역</h4><p>근무자마다 구분, 날짜, 시간과 업무 내용을 입력하세요.</p></div>
          <button type="button" onClick={openWorkerPicker}><Plus size={16} /> 근무자 추가</button>
        </div>}
        <div className="work-form-entry-list">
          {workRows.map((row, index) => {
            const employee = employees.find((item) => item.empId === row.empId) ?? employees[0];
            const types = availableTypes(employee);
            return (
              <article className="work-form-entry-card" key={index}>
                {canAddWorkers && <div className="work-form-entry-head compact">
                  <span className="work-form-entry-number">{index + 1}</span>
                  <label className="work-form-worker">
                    <span>근무자</span>
                    <select value={row.empId} onChange={(event) => changeWorker(index, Number(event.target.value))}>
                      {employees.map((item) => <option key={item.empId} value={item.empId}>{item.empName}{item.positionName || item.jobTitle ? " · " + (item.positionName || item.jobTitle) : ""}</option>)}
                    </select>
                  </label>
                  <label><span>구분</span><select value={row.workType} onChange={(event) => { const workType = event.target.value as WorkRow["workType"]; updateWork(index, { workType, ...defaultWorkTimes(workType), compTime: false }); }}>{types.map((type) => <option key={type} value={type}>{workTypeLabel(type)}</option>)}</select></label>
                  <label><span>근무일</span><input type="date" value={row.workDate} onChange={(event) => updateWork(index, { workDate: event.target.value })} /></label>
                  <label><span>시작</span><input type="time" value={row.startTime} onChange={(event) => updateWork(index, { startTime: event.target.value })} /></label>
                  <label><span>종료</span><input type="time" value={row.endTime} onChange={(event) => updateWork(index, { endTime: event.target.value })} /></label>
                  <button type="button" className="icon-button" title="근무자 삭제" disabled={workRows.length === 1} onClick={() => setWorkRows(workRows.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button>
                </div>}
                <div className={"work-form-field-grid" + (canAddWorkers ? " compact " + mode : "")}>
                  {!canAddWorkers && <><label><span>구분</span><select value={row.workType} onChange={(event) => { const workType = event.target.value as WorkRow["workType"]; updateWork(index, { workType, ...defaultWorkTimes(workType), compTime: false }); }}>{types.map((type) => <option key={type} value={type}>{workTypeLabel(type)}</option>)}</select></label><label><span>근무일</span><input type="date" value={row.workDate} onChange={(event) => updateWork(index, { workDate: event.target.value })} /></label><label><span>시작</span><input type="time" value={row.startTime} onChange={(event) => updateWork(index, { startTime: event.target.value })} /></label><label><span>종료</span><input type="time" value={row.endTime} onChange={(event) => updateWork(index, { endTime: event.target.value })} /></label></>}
                  <label className="wide work-form-content-field"><span>근무내용</span><input value={row.workContent} onChange={(event) => updateWork(index, { workContent: event.target.value })} placeholder="수행할 업무 내용을 입력하세요" /></label>
                  {mode === "request" && (
                    <label className={"work-form-comp-time wide" + (row.workType === "SPECIAL" ? " available" : "")}>
                      <input type="checkbox" disabled={row.workType !== "SPECIAL"} checked={row.compTime} onChange={(event) => updateWork(index, { compTime: event.target.checked })} />
                      <span><strong>대체근무 적용</strong><small>{row.workType === "SPECIAL" ? "특근 시간에 따라 대체휴무가 적립됩니다." : "특근 선택 시 적용할 수 있습니다."}</small></span>
                    </label>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        {mode === "request" && <div className="work-form-policy-note"><strong>대체휴무 기준</strong><span>4시간 이하는 0.5일, 4시간 초과는 1일 · 12월 15일 이후 발생분은 다음 해 1월 31일까지 사용</span></div>}
      </section>
    ) : (
      <section className="work-form-section work-change-section">
        {canAddWorkers && <div className="work-form-section-head">
          <div><h4>변경·취소 대상</h4><p>승인된 원 근무를 선택한 뒤 변경 또는 취소 사유를 작성하세요.</p></div>
          {!!schedules.length && <button type="button" onClick={() => setChangeRows([...changeRows, blankChange(schedules[0])])}><Plus size={16} /> 대상 추가</button>}
        </div>}
        {!schedules.length ? <div className="empty">변경하거나 취소할 근무예정 일정이 없습니다.</div> : (
          <div className="work-form-entry-list">
            {changeRows.map((row, index) => {
              const source = schedules.find((item) => item.workEntryId === row.sourceWorkEntryId) ?? schedules[0];
              return (
                <article className="work-form-entry-card work-change-card" key={index}>
                  <div className={"work-form-entry-head" + (!canAddWorkers ? " single" : "")}>
                    {canAddWorkers && <span className="work-form-entry-number change">{index + 1}</span>}
                    <label className="work-form-worker">
                      <span>원 근무 선택</span>
                      <select value={row.sourceWorkEntryId} onChange={(event) => { const next = schedules.find((item) => item.workEntryId === Number(event.target.value)); updateChange(index, blankChange(next)); }}>
                        {schedules.map((item) => <option key={item.workEntryId} value={item.workEntryId}>{item.workDate} · {item.empName} · {workTypeLabel(item.workType)} · {item.startTime.slice(0, 5)}~{item.endTime.slice(0, 5)}</option>)}
                      </select>
                    </label>
                    {canAddWorkers && <button type="button" className="icon-button" title="대상 삭제" disabled={changeRows.length === 1} onClick={() => setChangeRows(changeRows.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button>}
                  </div>
                  <div className="work-change-original">
                    <div><span>근무자</span><strong>{source.empName}</strong></div>
                    <div><span>구분</span><strong>{workTypeLabel(source.workType)}</strong></div>
                    <div><span>원 근무일</span><strong>{source.workDate}</strong></div>
                    <div><span>원 근무시간</span><strong>{source.startTime.slice(0, 5)}~{source.endTime.slice(0, 5)}</strong></div>
                    <div className="wide"><span>원 근무내용</span><strong>{source.workContent || "-"}</strong></div>
                  </div>
                  <div className="work-change-action-row">
                    <label><span>처리 구분</span><select value={row.actionType} onChange={(event) => updateChange(index, { actionType: event.target.value as ChangeRow["actionType"] })}><option value="CHANGE">변경</option><option value="CANCEL">취소</option></select></label>
                    <div className={"work-change-action-chip " + row.actionType.toLowerCase()}>{row.actionType === "CHANGE" ? "변경 후 내용을 입력하세요" : "원 근무를 취소합니다"}</div>
                  </div>
                  {row.actionType === "CHANGE" && (
                    <div className="work-change-after">
                      <div className="work-change-after-title"><span>원 근무</span><b>→</b><strong>변경 후</strong></div>
                      <div className="work-form-field-grid">
                        <label><span>변경 근무일</span><input type="date" value={row.newWorkDate} onChange={(event) => updateChange(index, { newWorkDate: event.target.value })} /></label>
                        <label><span>변경 시작</span><input type="time" value={row.newStartTime} onChange={(event) => updateChange(index, { newStartTime: event.target.value })} /></label>
                        <label><span>변경 종료</span><input type="time" value={row.newEndTime} onChange={(event) => updateChange(index, { newEndTime: event.target.value })} /></label>
                        <label className="wide"><span>변경 근무내용</span><input value={row.newWorkContent} onChange={(event) => updateChange(index, { newWorkContent: event.target.value })} placeholder="변경된 업무 내용을 입력하세요" /></label>
                        <label className={"work-form-comp-time wide" + (source.workType === "SPECIAL" ? " available" : "")}>
                          <input type="checkbox" disabled={source.workType !== "SPECIAL"} checked={row.newCompTime} onChange={(event) => updateChange(index, { newCompTime: event.target.checked })} />
                          <span><strong>변경 후 대체근무 적용</strong><small>{source.workType === "SPECIAL" ? "변경된 특근 일정에 대체휴무를 적용합니다." : "특근 일정만 적용할 수 있습니다."}</small></span>
                        </label>
                      </div>
                    </div>
                  )}
                  <label className="work-change-reason"><span>변경·취소 사유 <em>필수</em></span><textarea value={row.reason} onChange={(event) => updateChange(index, { reason: event.target.value })} placeholder="변경 또는 취소 사유를 입력하세요" /></label>
                </article>
              );
            })}
          </div>
        )}
        <div className="work-form-policy-note change"><strong>처리 원칙</strong><span>승인된 원문은 수정되지 않으며, 이 신청서가 최종 승인되면 예정 근무에 변경·취소 내용이 반영됩니다.</span></div>
      </section>
    )}

    {workerPickerOpen && mode !== "change" && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setWorkerPickerOpen(false)}>
      <div className="modal-card work-request-worker-modal" role="dialog" aria-modal="true" aria-label="근무자 선택">
        <div className="modal-head"><div><h3>근무자 선택</h3><p className="muted-text">근무 신청에 추가할 직원을 먼저 선택해 주세요.</p></div><button type="button" className="icon-button" onClick={() => setWorkerPickerOpen(false)} title="닫기"><X size={18} /></button></div>
        <div className="approval-form-grid"><label className="wide">근무자<select value={workerPickerEmpId ?? ""} onChange={(event) => setWorkerPickerEmpId(Number(event.target.value))}><option value="" disabled>근무자를 선택하세요</option>{employees.map((item) => <option key={item.empId} value={item.empId}>{item.empName}{item.positionName || item.jobTitle ? " · " + (item.positionName || item.jobTitle) : ""}{workRows.some((row) => row.empId === item.empId) ? " · 추가됨" : ""}</option>)}</select></label></div>
        <div className="actions"><button type="button" className="ghost" onClick={() => setWorkerPickerOpen(false)}>취소</button><button type="button" disabled={workerPickerEmpId == null} onClick={addSelectedWorker}>선택한 근무자 추가</button></div>
      </div>
    </div>}
  </div>;
}

export function WorkRequestDetailView({ approval }: { approval: Approval }) {
  const values = approvalDraftData(approval).fieldValues;
  const requestRows = parseRows<WorkRow>(values.workEntriesJson, []);
  const changeRows = parseRows<ChangeRow>(values.workChangesJson, []);
  return <article className="approval-detail"><section className="approval-detail-section"><h3>{approval.templateCode === "WORK_REQUEST_CHANGE" ? "근무 변경·취소 내역" : approval.templateCode === "EMERGENCY_CALL_REQUEST" ? "비상호출 신청 내역" : "근무 신청 내역"}</h3><div className="table-scroll"><table className="work-request-table"><thead>{requestRows.length ? <tr><th>근무자</th><th>구분</th><th>근무일</th><th>시간</th><th>내용</th><th>대체근무</th></tr> : <tr><th>원 일정 번호</th><th>처리</th><th>변경일</th><th>변경시간</th><th>사유</th></tr>}</thead><tbody>{requestRows.map((row) => <tr key={`${row.empId}-${row.workDate}-${row.startTime}`}><td>{row.deptName ? `${row.deptName} · ` : ""}{row.empName ?? `직원 #${row.empId}`}</td><td>{workTypeLabel(row.workType)}</td><td>{row.workDate}</td><td>{row.startTime}~{row.endTime}</td><td>{row.workContent}</td><td>{row.compTime ? "적용" : "미적용"}</td></tr>)}{changeRows.map((row) => <tr key={row.sourceWorkEntryId}><td>{row.sourceWorkEntryId}</td><td>{row.actionType === "CANCEL" ? "취소" : "변경"}</td><td>{row.actionType === "CHANGE" ? row.newWorkDate : "-"}</td><td>{row.actionType === "CHANGE" ? `${row.newStartTime}~${row.newEndTime}` : "-"}</td><td>{row.reason}</td></tr>)}</tbody></table></div></section></article>;
}

export { statusLabel as workScheduleStatusLabel, workTypeLabel };
