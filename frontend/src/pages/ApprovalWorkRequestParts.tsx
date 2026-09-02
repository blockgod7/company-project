import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api";
import { WorkTimeInput } from "../components/WorkTimeInput";
import type { Approval, Employee, User, WorkSchedule } from "../types";
import { approvalDraftData, type ApprovalForm } from "../utils/approvalDomain";

type WorkRow = { empId: number; empName?: string; deptName?: string | null; workType: WorkSchedule["workType"] | ""; workDate: string; startTime: string; endTime: string; workContent: string; compTime: boolean };
type ChangeRow = { sourceWorkEntryId: number; actionType: "CANCEL" | "CHANGE"; reason: string; newWorkDate: string; newStartTime: string; newEndTime: string; newWorkContent: string; newCompTime: boolean };
type WorkTypeFlag = "overtime" | "special" | "night" | "emergency";

const COMP_TIME_MINIMUM_MINUTES = 240;
const today = () => new Date().toISOString().slice(0, 10);
const defaultWorkTimes = (workType: WorkRow["workType"]) => workType === "OVERTIME"
  ? { startTime: "18:00", endTime: "20:00" }
  : workType.includes("SPECIAL") ? { startTime: "08:30", endTime: "17:30" }
    : workType.includes("NIGHT") ? { startTime: "20:00", endTime: "08:00" } : { startTime: "08:00", endTime: "17:00" };
const blankWork = (empId: number, mode: "request" | "emergency" = "request", management = false): WorkRow => {
  const workType: WorkRow["workType"] = mode === "emergency" ? "EMERGENCY_CALL" : management ? "SPECIAL" : "OVERTIME";
  const times = defaultWorkTimes(workType);
  return { empId, workType, workDate: today(), ...times, workContent: "", compTime: mode === "request" && management && canUseCompTime(workType, times.startTime, times.endTime) };
};
const blankChange = (source?: WorkSchedule): ChangeRow => {
  const newStartTime = source?.startTime?.slice(0, 5) ?? "08:00";
  const newEndTime = source?.endTime?.slice(0, 5) ?? "17:00";
  return { sourceWorkEntryId: source?.workEntryId ?? 0, actionType: "CANCEL", reason: "", newWorkDate: source?.workDate ?? today(), newStartTime, newEndTime, newWorkContent: source?.workContent ?? "", newCompTime: !!source?.compTime && canUseCompTime(source.workType, newStartTime, newEndTime) };
};

function parseRows<T>(value: string | undefined, fallback: T[]): T[] { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) && parsed.length ? parsed : fallback; } catch { return fallback; } }
function workTypeFlags(type: WorkRow["workType"]) {
  return { overtime: type.includes("OVERTIME"), special: type.includes("SPECIAL"), night: type.includes("NIGHT"), emergency: type === "EMERGENCY_CALL" };
}
function workTypeFromFlags(flags: Record<WorkTypeFlag, boolean>): WorkRow["workType"] {
  if (flags.emergency) return "EMERGENCY_CALL";
  if (flags.special && flags.night && flags.overtime) return "SPECIAL_NIGHT_OVERTIME";
  if (flags.special && flags.night) return "SPECIAL_NIGHT";
  if (flags.special && flags.overtime) return "SPECIAL_OVERTIME";
  if (flags.night && flags.overtime) return "NIGHT_OVERTIME";
  if (flags.special) return "SPECIAL";
  if (flags.night) return "NIGHT";
  if (flags.overtime) return "OVERTIME";
  return "";
}
function isSpecialWork(type: WorkRow["workType"]) { return type.includes("SPECIAL"); }
function workDurationMinutes(startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  if ([startHour, startMinute, endHour, endMinute].some((value) => !Number.isFinite(value))) return 0;
  let minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes;
}
function canUseCompTime(type: WorkRow["workType"], startTime: string, endTime: string) {
  return isSpecialWork(type) && workDurationMinutes(startTime, endTime) >= COMP_TIME_MINIMUM_MINUTES;
}
function workTypeLabel(type: WorkRow["workType"]) {
  if (type === "OVERTIME") return "주간 잔업";
  if (type === "NIGHT") return "야간";
  if (type === "NIGHT_OVERTIME") return "야간 잔업";
  if (type === "SPECIAL") return "특근";
  if (type === "SPECIAL_OVERTIME") return "특근 + 잔업";
  if (type === "SPECIAL_NIGHT") return "특근 + 야간";
  if (type === "SPECIAL_NIGHT_OVERTIME") return "특근 + 야간 + 잔업";
  if (type === "EMERGENCY_CALL") return "비상호출";
  return "근무 구분 미선택";
}
function statusLabel(status: WorkSchedule["status"]) { return status === "PLANNED" ? "근무 예정" : status === "COMPLETED" ? "근무 완료" : status === "CANCEL_PENDING" ? "취소 결재중" : status === "CANCELED" ? "취소" : "결재중"; }

function WorkTypeSelector({ value, fieldEmployee, onChange }: { value: WorkRow["workType"]; fieldEmployee: boolean; onChange: (flag: WorkTypeFlag, checked: boolean) => void }) {
  const flags = workTypeFlags(value);
  const options: { flag: WorkTypeFlag; label: string }[] = fieldEmployee
    ? [{ flag: "overtime", label: "잔업" }, { flag: "special", label: "특근" }, { flag: "night", label: "야간" }, { flag: "emergency", label: "비상호출" }]
    : [{ flag: "special", label: "특근" }, { flag: "emergency", label: "비상호출" }];
  return <fieldset className="work-type-selector">
    <legend>근무 구분</legend>
    <div className="work-type-options">{options.map((option) => <label className={flags[option.flag] ? "work-type-option selected" : "work-type-option"} key={option.flag}>
      <input type="checkbox" checked={flags[option.flag]} onChange={(event) => onChange(option.flag, event.target.checked)} />
      <span>{option.label}</span>
    </label>)}</div>
  </fieldset>;
}

export function WorkRequestEditor({ mode, user, form, headerActions, onChange, readOnly = false }: { mode: "request" | "emergency" | "change"; user: User; form: ApprovalForm; headerActions?: ReactNode; onChange: (form: ApprovalForm) => void; readOnly?: boolean }) {
  const [candidates, setCandidates] = useState<Employee[]>([]);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [workerPickerOpen, setWorkerPickerOpen] = useState(false);
  const [workerPickerEmpId, setWorkerPickerEmpId] = useState<number | null>(null);
  const delegated = user.permissions.includes("WORK_REQUEST_DELEGATE") || user.permissions.includes("WORK_REQUEST_ADMIN") || user.roleCode === "ADMIN" || user.permissions.includes("FULL_ADMIN");
  useEffect(() => {
    let active = true;
    void api<Employee[]>("/work-schedules/candidates")
      .then((items) => { if (active) setCandidates(items); })
      .catch(() => { if (active) setCandidates([]); })
      .finally(() => { if (active) setCandidatesLoaded(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (mode !== "change") return;
    let active = true;
    void api<WorkSchedule[]>(`/work-schedules/changeable${delegated ? "?all=true" : ""}`)
      .then((items) => { if (active) setSchedules(items); })
      .catch(() => { if (active) setSchedules([]); });
    return () => { active = false; };
  }, [mode, delegated]);
  const employees = candidates.length ? candidates : [{ empId: user.empId, empName: user.empName, deptId: user.deptId, deptName: user.deptName, workCategory: "FIELD" } as Employee];
  const requestMode = mode === "emergency" ? "emergency" : "request";
  const workRows = useMemo(
    () => parseRows<WorkRow>(form.fieldValues.workEntriesJson, delegated && mode === "request" ? [] : [blankWork(user.empId, requestMode, candidates.find((item) => item.empId === user.empId)?.workCategory === "MANAGEMENT")]),
    [form.fieldValues.workEntriesJson, user.empId, requestMode, delegated, mode, candidates]
  );
  const commonWorkDate = form.fieldValues.workDate || workRows[0]?.workDate || today();
  const changeRows = useMemo(() => parseRows<ChangeRow>(form.fieldValues.workChangesJson, schedules[0] ? [blankChange(schedules[0])] : []), [form.fieldValues.workChangesJson, schedules]);
  const setWorkRows = (rows: WorkRow[], nextCommonDate = commonWorkDate) => onChange({
    ...form,
    fieldValues: {
      ...form.fieldValues,
      ...(mode === "request" ? { workDate: nextCommonDate } : {}),
      workEntriesJson: JSON.stringify(rows.map((row) => {
        const employee = employees.find((item) => item.empId === row.empId);
        return {
          ...row,
          ...(mode === "request" ? { workDate: nextCommonDate } : {}),
          empName: employee?.empName ?? row.empName,
          deptName: employee?.deptName ?? row.deptName,
          compTime: canUseCompTime(row.workType, row.startTime, row.endTime) && row.compTime
        };
      }))
    }
  });
  const setChangeRows = (rows: ChangeRow[]) => onChange({
    ...form,
    fieldValues: {
      ...form.fieldValues,
      workChangesJson: JSON.stringify(rows.map((row) => {
        const source = schedules.find((item) => item.workEntryId === row.sourceWorkEntryId);
        return {
          ...row,
          newCompTime: !!source && canUseCompTime(source.workType, row.newStartTime, row.newEndTime) && row.newCompTime
        };
      }))
    }
  });
  useEffect(() => {
    if (!readOnly && mode !== "change" && candidatesLoaded && !form.fieldValues.workEntriesJson) {
      const requester = candidates.find((item) => item.empId === user.empId);
      if (mode === "request" && delegated) {
        setWorkRows([]);
        setWorkerPickerOpen(true);
      } else {
        setWorkRows([blankWork(user.empId, requestMode, requester?.workCategory === "MANAGEMENT")]);
      }
    }
  }, [mode, candidates, candidatesLoaded, form.fieldValues.workEntriesJson, user.empId, requestMode, delegated, readOnly]);
  useEffect(() => {
    if (!readOnly && mode === "change" && schedules[0] && !form.fieldValues.workChangesJson) setChangeRows([blankChange(schedules[0])]);
  }, [mode, schedules, form.fieldValues.workChangesJson, readOnly]);
  const updateWork = (index: number, next: Partial<WorkRow>) => setWorkRows(workRows.map((row, i) => i === index ? { ...row, ...next } : row));
  const updateChange = (index: number, next: Partial<ChangeRow>) => setChangeRows(changeRows.map((row, i) => i === index ? { ...row, ...next } : row));
  const updateWorkTime = (index: number, field: "startTime" | "endTime", value: string) => {
    const current = workRows[index];
    const next = { ...current, [field]: value };
    updateWork(index, { [field]: value, compTime: canUseCompTime(next.workType, next.startTime, next.endTime) ? current.compTime : false });
  };
  const updateChangeTime = (index: number, field: "newStartTime" | "newEndTime", value: string, source: WorkSchedule) => {
    const current = changeRows[index];
    const next = { ...current, [field]: value };
    updateChange(index, { [field]: value, newCompTime: canUseCompTime(source.workType, next.newStartTime, next.newEndTime) ? current.newCompTime : false });
  };
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
    if (!readOnly && (!form.title.trim() || automaticTitles.includes(form.title))) onChange({ ...form, title: generatedTitle });
  }, [mode, departmentTitle, readOnly]);

  const changeWorker = (index: number, empId: number) => {
    const employee = employees.find((item) => item.empId === empId);
    const current = workRows[index];
    const fieldEmployee = employee?.workCategory !== "MANAGEMENT";
    const currentFlags = workTypeFlags(current.workType);
    const workType = fieldEmployee || (!currentFlags.overtime && !currentFlags.night) ? current.workType : "SPECIAL";
    const times = workType === current.workType ? { startTime: current.startTime, endTime: current.endTime } : defaultWorkTimes(workType);
    updateWork(index, {
      empId,
      workType,
      ...(workType === current.workType ? {} : times),
      compTime: employee?.workCategory === "MANAGEMENT" && canUseCompTime(workType, times.startTime, times.endTime)
    });
  };
  const updateWorkType = (index: number, flag: WorkTypeFlag, checked: boolean) => {
    const current = workRows[index];
    const flags = workTypeFlags(current.workType);
    if (flag !== "emergency" && checked) flags.emergency = false;
    const workType = workTypeFromFlags({ ...flags, [flag]: checked });
    updateWork(index, { workType, compTime: canUseCompTime(workType, current.startTime, current.endTime) ? current.compTime : false });
  };

  return <div className={"work-request-editor work-request-form " + mode}>
    <div className={"work-form-hero " + mode}>
      <label className="work-form-title">
        <span className="work-form-kicker">{mode === "change" ? "근무 변경·취소 신청" : mode === "emergency" ? "비상호출 근무 신청" : "잔업·특근·야간·비상호출 근무 신청"}</span>
        <span>문서 제목</span>
        <input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} />
      </label>
      {headerActions}
    </div>
    <div className={"work-form-applicant" + (mode === "request" ? " has-common-date" : "")}>
      <div><span>신청부서</span><strong>{departmentTitle}</strong></div>
      <div><span>신청자</span><strong>{user.empName}</strong></div>
      <div><span>작성일</span><strong>{today()}</strong></div>
      {mode === "request" && <div className="work-form-common-date"><span>근무일자</span><input required aria-label="근무일자" type="date" value={commonWorkDate} onChange={(event) => setWorkRows(workRows, event.target.value)} /></div>}
    </div>
    {mode !== "change" ? (
      <section className="work-form-section">
        <div className="work-form-section-head">
          <div><h4>근무자별 신청 내역</h4><p>{mode === "request" ? "상단 근무일자가 모든 근무자에게 공통 적용됩니다. 잔업·특근·야간은 함께 선택할 수 있으며, 비상호출은 단독으로 선택합니다." : "근무자별 시간과 업무 내용을 입력하세요."}</p></div>
          {canAddWorkers && <button type="button" onClick={openWorkerPicker}><Plus size={16} /> 근무자 추가</button>}
        </div>
        <div className="work-form-entry-list">
          {!workRows.length && <div className="empty compact">근무자를 추가해 주세요.</div>}
          {workRows.map((row, index) => {
            const employee = employees.find((item) => item.empId === row.empId) ?? employees[0];
            const compTimeAvailable = canUseCompTime(row.workType, row.startTime, row.endTime);
            return (
              <article className={"work-form-entry-card work-form-entry-row " + mode} key={index}>
                <div className={"work-form-row-grid " + mode}>
                  <span className="work-form-entry-number">{index + 1}</span>
                  <label className="work-form-worker">
                    <span>근무자</span>
                    {canAddWorkers ? (
                    <select value={row.empId} onChange={(event) => changeWorker(index, Number(event.target.value))}>
                      {employees.map((item) => <option key={item.empId} value={item.empId}>{item.empName}{item.positionName || item.jobTitle ? " · " + (item.positionName || item.jobTitle) : ""}</option>)}
                    </select>
                    ) : <input readOnly value={employee.empName + (employee.positionName || employee.jobTitle ? " · " + (employee.positionName || employee.jobTitle) : "")} />}
                  </label>
                  <label className="work-form-content-field"><span>근무내용</span><textarea className="work-content-input" rows={1} wrap="off" value={row.workContent} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) event.preventDefault(); }} onChange={(event) => updateWork(index, { workContent: event.target.value.replace(/[\r\n]+/g, " ") })} placeholder="수행할 업무 내용을 입력하세요" /></label>
                  {mode === "request"
                    ? <WorkTypeSelector value={row.workType} fieldEmployee={employee.workCategory !== "MANAGEMENT"} onChange={(flag, checked) => updateWorkType(index, flag, checked)} />
                    : <label><span>근무 구분</span><select value={row.workType} disabled><option value="EMERGENCY_CALL">비상호출</option></select></label>}
                  {mode === "request" && (
                    <label className={"work-form-comp-time" + (compTimeAvailable ? " available" : "")}>
                      <input type="checkbox" disabled={!compTimeAvailable} checked={compTimeAvailable && row.compTime} onChange={(event) => updateWork(index, { compTime: compTimeAvailable && event.target.checked })} />
                      <span><strong>대체근무</strong><small>{!isSpecialWork(row.workType) ? "특근 선택 시 가능" : compTimeAvailable ? "4시간 이상 · 1일 적립" : "4시간 이상 근무 시 가능"}</small></span>
                    </label>
                  )}
                  <div className="work-form-time-field work-form-time-start"><span>시작</span><WorkTimeInput label="시작" value={row.startTime} onChange={(value) => updateWorkTime(index, "startTime", value)} /></div>
                  <div className="work-form-time-field work-form-time-end"><span>종료</span><WorkTimeInput label="종료" value={row.endTime} onChange={(value) => updateWorkTime(index, "endTime", value)} /></div>
                  <button type="button" className="icon-button" title="근무자 삭제" disabled={!canAddWorkers || workRows.length === 1} onClick={() => setWorkRows(workRows.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={16} /></button>
                </div>
              </article>
            );
          })}
        </div>
        {mode === "request" && workRows.some((row) => row.compTime && canUseCompTime(row.workType, row.startTime, row.endTime)) && <div className="work-form-policy-note"><strong>대체휴무 기준</strong><span>특근 4시간 이상 근무 시 1일 · 12월 15일 이후 발생분은 다음 해 1월 31일까지 사용</span></div>}
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
              const compTimeAvailable = canUseCompTime(source.workType, row.newStartTime, row.newEndTime);
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
                        <div className="work-form-time-field"><span>변경 시작</span><WorkTimeInput label="변경 시작" value={row.newStartTime} onChange={(value) => updateChangeTime(index, "newStartTime", value, source)} /></div>
                        <div className="work-form-time-field"><span>변경 종료</span><WorkTimeInput label="변경 종료" value={row.newEndTime} onChange={(value) => updateChangeTime(index, "newEndTime", value, source)} /></div>
                        <label className="wide"><span>변경 근무내용</span><input value={row.newWorkContent} onChange={(event) => updateChange(index, { newWorkContent: event.target.value })} placeholder="변경된 업무 내용을 입력하세요" /></label>
                        <label className={"work-form-comp-time wide" + (compTimeAvailable ? " available" : "")}>
                          <input type="checkbox" disabled={!compTimeAvailable} checked={compTimeAvailable && row.newCompTime} onChange={(event) => updateChange(index, { newCompTime: compTimeAvailable && event.target.checked })} />
                          <span><strong>변경 후 대체근무 적용</strong><small>{!isSpecialWork(source.workType) ? "특근 일정만 적용할 수 있습니다." : compTimeAvailable ? "변경된 특근 일정에 대체휴무 1일을 적용합니다." : "변경 근무시간이 4시간 이상이어야 합니다."}</small></span>
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
  const commonDate = requestRows[0]?.workDate || values.workDate;
  const commonDateDocument = approval.templateCode === "WORK_REQUEST";
  return <article className="approval-detail"><section className="approval-detail-section">
    <h3>{approval.templateCode === "WORK_REQUEST_CHANGE" ? "근무 변경·취소 내역" : approval.templateCode === "EMERGENCY_CALL_REQUEST" ? "비상호출 신청 내역" : "근무 신청 내역"}</h3>
    {commonDateDocument && commonDate && <div className="work-detail-common-date"><span>근무일자</span><strong>{commonDate}</strong></div>}
    <div className="table-scroll"><table className="work-request-table">
      <thead>{requestRows.length
        ? <tr><th>근무자</th><th>구분</th>{!commonDateDocument && <th>근무일</th>}<th>시간</th><th>내용</th><th>대체근무</th></tr>
        : <tr><th>원 일정 번호</th><th>처리</th><th>변경일</th><th>변경시간</th><th>사유</th></tr>}</thead>
      <tbody>{requestRows.map((row) => <tr key={`${row.empId}-${row.workDate}-${row.startTime}`}><td>{row.deptName ? `${row.deptName} · ` : ""}{row.empName ?? `직원 #${row.empId}`}</td><td>{workTypeLabel(row.workType)}</td>{!commonDateDocument && <td>{row.workDate}</td>}<td>{row.startTime}~{row.endTime}</td><td>{row.workContent}</td><td>{row.compTime ? "적용" : "미적용"}</td></tr>)}{changeRows.map((row) => <tr key={row.sourceWorkEntryId}><td>{row.sourceWorkEntryId}</td><td>{row.actionType === "CANCEL" ? "취소" : "변경"}</td><td>{row.actionType === "CHANGE" ? row.newWorkDate : "-"}</td><td>{row.actionType === "CHANGE" ? `${row.newStartTime}~${row.newEndTime}` : "-"}</td><td>{row.reason}</td></tr>)}</tbody>
    </table></div>
  </section></article>;
}

export { statusLabel as workScheduleStatusLabel, workTypeLabel };
