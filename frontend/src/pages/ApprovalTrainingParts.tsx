import { BookOpen, ChevronDown, ClipboardCheck, FileText } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import type { Employee, User, TrainingSchedule } from "../types";
import {
  todayDate,
  trainingReportDefaultFieldValues,
  trainingRequestDefaultFieldValues,
  type ApprovalForm
} from "../utils/approvalDomain";

type TrainingMode = "request" | "report" | "change";
type TrainingValues = Record<string, string>;
type TrainingEditorProps = {
  user: User;
  employees: Employee[];
  form: ApprovalForm;
  headerActions?: ReactNode;
  editingApprovalId?: number;
  onChange: (form: ApprovalForm) => void;
};

export function TrainingDocumentOverview({ mode, values, children, titleField, actions, readOnly = false }: {
  mode: TrainingMode;
  values: TrainingValues;
  children?: ReactNode;
  titleField?: ReactNode;
  actions?: ReactNode;
  readOnly?: boolean;
}) {
  const report = mode === "report";
  const applicant = report
    ? [["작성부서", values.deptName], ["작성자", [values.requesterName, values.positionName].filter(Boolean).join(" · ")], ["작성일", values.reportDate]]
    : [["신청부서", values.deptName], ["신청자", [values.requesterName, values.positionName].filter(Boolean).join(" · ")], ["작성일", values.requestDate]];

  return <section className="training-overview">
    <div className="training-web-head">
      <div className="training-heading">
        <span className="training-eyebrow">{report ? "교육 결과 보고" : mode === "change" ? "교육 변경·취소" : "교육 신청"}<span>전자결재</span></span>
        {titleField || <h2>{report ? "교육훈련보고서" : mode === "change" ? "교육 변경·취소 신청서" : "교육신청서"}</h2>}
      </div>
      {actions}
    </div>
    {children}
    <dl className="training-applicant-row">
      {applicant.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}
    </dl>
    {readOnly && <span className="training-sr-only">문서에 기록된 교육 정보와 결재 내역입니다.</span>}
  </section>;
}

function TrainingSection({ title, description, icon, children, className = "", accessory }: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  accessory?: ReactNode;
}) {
  return <section className={`training-web-card ${className}`}>
    <div className="training-section-head">
      <div>{icon}<h3>{title}</h3></div>
      {accessory}
    </div>
    {description && <p className="training-section-description">{description}</p>}
    {children}
  </section>;
}

function TrainingSupplement({ children, initialOpen }: { children: ReactNode; initialOpen: boolean }) {
  // Keep the initial attribute stable; native details owns subsequent toggles.
  const [initiallyExpanded] = useState(initialOpen);
  return <details className="training-web-card training-supplement" open={initiallyExpanded}>
    <summary>
      <ClipboardCheck size={17} aria-hidden="true" />
      <strong>평가 및 인사 확인</strong>
      <span>유효성 평가 · 인사카드 기록</span>
      <ChevronDown size={16} aria-hidden="true" />
    </summary>
    <div className="training-supplement-body">{children}</div>
  </details>;
}

export function TrainingDocumentFields({ mode, values, onFieldChange, preview = false }: {
  mode: TrainingMode;
  values: TrainingValues;
  onFieldChange?: (name: string, value: string) => void;
  preview?: boolean;
}) {
  const report = mode === "report";
  const editable = !!onFieldChange;
  function field(name: string, label: string, {
    required = false, multiline = false, wide = false, placeholder = "", type = "text", rows = 3, hideLabel = false, compact = false
  } = {}) {
    const caption = <span className={hideLabel ? "training-sr-only" : undefined}>{label}{required && (editable || preview) && <span className="required-mark" aria-hidden="true"> *</span>}</span>;
    const className = `training-field${wide ? " wide" : ""}${compact ? " compact" : ""}`;
    const locked = (report && !!values.sourceTrainingApprovalId && ["trainingName", "institution", "trainingPeriod"].includes(name)) || (mode === "change" && values.changeAction === "CANCEL" && ["trainingName", "institution", "trainingStartDate", "trainingEndDate"].includes(name));
    if (!editable || locked) return <div className={className}>
      {caption}
      <div className={`training-field-value${multiline ? " multiline" : ""}${!values[name] ? " is-empty" : ""}`}>
        {values[name] || (preview ? placeholder || "작성 시 입력" : "—")}
      </div>
    </div>;
    return <label className={className}>
      {caption}
      {multiline
        ? <textarea rows={rows} required={required} value={values[name] ?? ""} placeholder={placeholder} onChange={(event) => onFieldChange?.(name, event.target.value)} />
        : <input type={type} required={required} value={values[name] ?? ""} placeholder={placeholder} onChange={(event) => onFieldChange?.(name, event.target.value)} />}
    </label>;
  }

  return <div className={`training-document-fields ${mode}`}>
    <TrainingSection title="교육 기본정보" icon={<BookOpen size={17} aria-hidden="true" />} accessory={(editable || preview) && <span className="training-required-note"><b>*</b> 필수 입력</span>}>
      <div className="training-field-grid training-course-grid">
        {field("trainingName", "교육명", { required: true, placeholder: report ? "참여한 교육명을 입력하세요" : "신청할 교육명을 입력하세요" })}
        {field("institution", "교육기관", { required: true, placeholder: "교육기관명" })}
      </div>
      <div className={`training-schedule-row${report ? " is-report" : ""}`}>
        {report
          ? field("trainingPeriod", "교육기간", { required: true, placeholder: "교육 시작일 ~ 종료일" })
          : <>
            <div className="training-period-field">
              <span>교육기간</span>
              <div className="training-date-range">
                {field("trainingStartDate", "교육 시작일", { type: "date", hideLabel: true })}
                <span aria-hidden="true">—</span>
                {field("trainingEndDate", "교육 종료일", { type: "date", hideLabel: true })}
              </div>
            </div>
            {!editable && !preview && values.requestType && values.requestType !== "수강" && field("requestType", "기존 신청 구분")}
          </>}
      </div>
    </TrainingSection>
    {!report ? <TrainingSection title={mode === "change" ? "변경·취소 사유" : "신청 사유"} description={editable || preview ? "교육 목적과 현재 업무와의 관련성을 구체적으로 작성해 주세요." : undefined} icon={<FileText size={17} aria-hidden="true" />} className="training-reason-section" accessory={(editable || preview) && <span className="training-required-note"><b>*</b> 필수 입력</span>}>
      {field(mode === "change" ? "changeReason" : "reason", "사유(구체적)", { required: true, multiline: true, rows: 5, hideLabel: true, placeholder: "교육을 통해 배우고 싶은 내용과 업무에 활용할 계획을 작성하세요." })}
    </TrainingSection> : <>
      <TrainingSection title="교육 결과" description={editable || preview ? "핵심 교육 내용과 업무에 적용할 내용을 중심으로 정리해 주세요." : undefined} icon={<FileText size={17} aria-hidden="true" />}>
        <div className="training-field-grid training-result-grid">
          {field("mainContent", "주요 교육 내용", { multiline: true, rows: 5, wide: true, placeholder: "교육 주제, 주요 학습 내용, 실습 결과 등을 작성하세요." })}
          {field("jobApplication", "업무 수행 방안", { multiline: true, placeholder: "실제 업무에 적용할 방법과 기대 효과" })}
          {field("impression", "교육 소감", { multiline: true, placeholder: "도움이 된 점과 개선이 필요한 점" })}
          {field("nextTraining", "차기에 받고 싶은 교육", { multiline: true, rows: 2, wide: true, compact: true, placeholder: "업무에 도움이 될 후속 교육이 있다면 작성하세요." })}
        </div>
      </TrainingSection>
      <TrainingSupplement initialOpen={!editable || !!values.effectiveness || !!values.hrRecordCheck}>
        <div className="training-field-grid">
          {field("effectiveness", "유효성 평가(시급,속도,균형)", { multiline: true, placeholder: "교육 유효성 평가 내용" })}
          {field("hrRecordCheck", "총무 인사카드기록 확인", { multiline: true, placeholder: "인사카드 기록 확인 내용" })}
        </div>
        <div className="training-signature"><span>서명</span><strong>{values.signatureName || "—"}</strong></div>
      </TrainingSupplement>
    </>}
  </div>;
}

function TrainingEditor({ mode, user, employees, form, headerActions, editingApprovalId, onChange }: TrainingEditorProps & { mode: TrainingMode }) {
  const report = mode === "report";
  const values = report
    ? trainingReportDefaultFieldValues(user, employees, form.fieldValues)
    : trainingRequestDefaultFieldValues(user, employees, form.fieldValues);

  return <div className={`training-web-form training-editor ${mode}`}>
    <TrainingDocumentOverview mode={mode} values={values} actions={headerActions} titleField={
      <label className="training-field training-document-title">
        <span className="training-sr-only">문서 제목</span>
        <input required value={form.title} placeholder={report ? "교육훈련보고서 제목" : mode === "change" ? "교육 변경·취소 신청서 제목" : "교육신청서 제목"} onChange={(event) => onChange({ ...form, title: event.target.value })} />
      </label>
    } />
    {(report || mode === "change") && <TrainingSourcePicker mode={mode} form={form} editingApprovalId={editingApprovalId} onChange={onChange} />}
    <TrainingDocumentFields mode={mode} values={values} onFieldChange={(name, value) => onChange({ ...form, fieldValues: { ...form.fieldValues, ...values, [name]: value } })} />
  </div>;
}

export function TrainingRequestEditor(props: TrainingEditorProps) {
  return <TrainingEditor {...props} mode={props.form.templateCode === "TRAINING_CHANGE" ? "change" : "request"} />;
}

export function TrainingReportEditor(props: TrainingEditorProps) {
  return <TrainingEditor {...props} mode="report" />;
}

export function TrainingTemplatePreview({ mode, requesterName, deptName }: { mode: TrainingMode; requesterName: string; deptName: string }) {
  const values = { requesterName, deptName, requestDate: todayDate(), reportDate: todayDate(), signatureName: requesterName, requestType: "수강" };
  return <div className="training-web-form training-template-preview">
    <TrainingDocumentOverview mode={mode} values={values} />
    <TrainingDocumentFields mode={mode} values={values} preview />
  </div>;
}
function TrainingSourcePicker({ mode, form, editingApprovalId, onChange }: Pick<TrainingEditorProps, "form" | "editingApprovalId" | "onChange"> & { mode: TrainingMode }) {
  const [items, setItems] = useState<TrainingSchedule[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const legacy = !!editingApprovalId && form.fieldValues.educationWorkflowVersion !== "1";
  useEffect(() => {
    if (legacy) return;
    let active = true;
    setLoading(true); setError("");
    void api<TrainingSchedule[]>(`/trainings/me${editingApprovalId ? `?editingApprovalId=${editingApprovalId}` : ""}`)
      .then(data => { if (active) setItems(data); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "교육 목록을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [editingApprovalId, legacy, reload]);
  if (legacy) return <p className="muted-text">연동 도입 전에 작성된 문서로 기존 처리 방식을 유지합니다.</p>;
  const selected = items.find(item => String(item.sourceApprovalId) === form.fieldValues.sourceTrainingApprovalId);
  const report = mode === "report";
  function selectSource(id: string) {
    const item = items.find(candidate => String(candidate.sourceApprovalId) === id);
    if (!item) return;
    onChange({ ...form, fieldValues: { ...form.fieldValues,
      sourceTrainingApprovalId: id, sourceTrainingRevisionId: String(item.currentApprovalId),
      sourceTrainingDocumentNo: item.documentNo || "",
      trainingName: item.trainingName, institution: item.institution,
      trainingStartDate: item.startDate, trainingEndDate: item.endDate,
      trainingPeriod: `${item.startDate} ~ ${item.endDate}`,
      ...(report ? {} : { changeAction: form.fieldValues.changeAction || "CHANGE" })
    } });
  }
  return <TrainingSection title={report ? "보고할 교육 선택" : "변경·취소할 교육 선택"} icon={<BookOpen size={17} aria-hidden="true" />}>
    <p className="muted-text">{report ? "교육기간이 끝난 교육을 선택하세요. 보고서는 수신자의 접수 완료 후 이수 완료로 반영됩니다." : "최종 승인된 본인의 교육만 선택할 수 있습니다. 보고서 작성 이력이 있는 교육은 변경·취소할 수 없습니다."}</p>
    {error ? <div role="alert">{error} <button type="button" onClick={() => setReload(value => value + 1)}>다시 불러오기</button></div> : <label className="training-field"><span>원 교육신청서</span>
      <select aria-label="원 교육신청서" value={form.fieldValues.sourceTrainingApprovalId || ""} disabled={loading || !!editingApprovalId} onChange={event => selectSource(event.target.value)}>
        <option value="">{loading ? "교육 목록을 불러오는 중…" : "교육을 선택하세요"}</option>
        {items.map(item => <option key={item.sourceApprovalId} value={item.sourceApprovalId} disabled={report ? !item.reportable : !item.changeable}>
          {item.trainingName} · {item.startDate} ~ {item.endDate}{(report ? !item.reportable : !item.changeable) ? ` · ${item.blockedReason || "선택 불가"}` : ""}
        </option>)}
      </select>
    </label>}
    {!loading && !error && !items.length && <p className="muted-text">선택 가능한 교육이 없습니다. 연동 도입 후 신청하고 최종 승인된 교육부터 표시됩니다.</p>}
    {selected && <div className="training-source-summary"><strong>{selected.documentNo || "원 교육신청서"}</strong><span>{selected.trainingName} · {selected.institution}</span><span>{selected.startDate} ~ {selected.endDate}</span></div>}
    {!report && <label className="training-field"><span>처리 구분</span><select value={form.fieldValues.changeAction || "CHANGE"} onChange={event => onChange({ ...form, fieldValues: { ...form.fieldValues, changeAction: event.target.value, ...(event.target.value === "CANCEL" && selected ? { trainingName: selected.trainingName, institution: selected.institution, trainingStartDate: selected.startDate, trainingEndDate: selected.endDate } : {}) } })}><option value="CHANGE">교육 변경</option><option value="CANCEL">교육 취소</option></select></label>}
  </TrainingSection>;
}
