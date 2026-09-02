import type { ReactNode } from "react";
import type { ApprovalHoliday, CompTimeSummary, Employee, LeaveUsage, User } from "../types";
import {
  isDraftTemplateCode, isEquipmentProposalTemplateCode, isLeaveCancelTemplateCode,
  isLeaveTemplateCode, isPurchaseTemplateCode, isTrainingReportTemplateCode,
  isTrainingRequestTemplateCode, isWorkRequestTemplateCode, isWorkRequestChangeTemplateCode,
  isEmergencyCallRequestTemplateCode, parseTemplateFields,
  type ApprovalForm, type ApprovalTemplateOption
} from "../utils/approvalDomain";
import { ClassicDraftEditor } from "./ApprovalClassicParts";
import {
  EquipmentProposalEditor, LeaveRequestEditor, PurchaseRequestEditor, TemplateFieldInputs,
  TrainingReportEditor, TrainingRequestEditor, WorkRequestEditor
} from "./ApprovalFormParts";

export type ApprovalFormContext = {
  user: User;
  employees: Employee[];
  leaveUsage: LeaveUsage | null;
  compTimeSummary: CompTimeSummary | null;
  holidays: ApprovalHoliday[];
  leaveTypeOptions: string[];
};

type Props = ApprovalFormContext & {
  form: ApprovalForm;
  template: ApprovalTemplateOption;
  templates: ApprovalTemplateOption[];
  onChange: (form: ApprovalForm) => void;
  onTemplateChange?: (code: string) => void;
  onBalanceYearChange?: (year: number) => void;
  headerActions?: ReactNode;
  editingApprovalId?: number;
  readOnly?: boolean;
};

// The only template-to-editor routing table: compose and both previews use it.
export function ApprovalFormBody({ form, template, templates, onChange, onTemplateChange, onBalanceYearChange, headerActions, editingApprovalId, readOnly = false, ...context }: Props) {
  const { user, employees } = context;
  const update = readOnly ? () => undefined : onChange;
  const editorProps = { user, employees, form, onChange: update, headerActions: readOnly ? undefined : headerActions };
  const code = form.templateCode;
  let body: ReactNode;
  if (isDraftTemplateCode(code)) body = <ClassicDraftEditor {...editorProps} readOnly={readOnly} />;
  else if (isLeaveTemplateCode(code) || isLeaveCancelTemplateCode(code)) body = <LeaveRequestEditor {...context} {...editorProps} mode={isLeaveCancelTemplateCode(code) ? "cancel" : "request"} onBalanceYearChange={readOnly ? undefined : onBalanceYearChange} />;
  else if (isWorkRequestTemplateCode(code) || isEmergencyCallRequestTemplateCode(code) || isWorkRequestChangeTemplateCode(code)) body = <WorkRequestEditor {...editorProps} mode={isWorkRequestChangeTemplateCode(code) ? "change" : isEmergencyCallRequestTemplateCode(code) ? "emergency" : "request"} readOnly={readOnly} />;
  else if (isPurchaseTemplateCode(code)) body = <PurchaseRequestEditor {...editorProps} />;
  else if (isTrainingRequestTemplateCode(code)) body = <TrainingRequestEditor {...editorProps} editingApprovalId={editingApprovalId} />;
  else if (isTrainingReportTemplateCode(code)) body = <TrainingReportEditor {...editorProps} editingApprovalId={editingApprovalId} />;
  else if (isEquipmentProposalTemplateCode(code)) body = <EquipmentProposalEditor {...editorProps} />;
  else body = <>
    <div className="approval-form-grid">
      <label>양식명<select value={code} onChange={(event) => !readOnly && onTemplateChange?.(event.target.value)}>{templates.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
      <label>문서 중요도<select value={form.priority} onChange={(event) => update({ ...form, priority: event.target.value as ApprovalForm["priority"] })}><option value="NORMAL">일반</option><option value="IMPORTANT">중요</option><option value="URGENT">긴급</option></select></label>
      <label className="wide">문서 제목<input value={form.title} onChange={(event) => update({ ...form, title: event.target.value })} placeholder="문서 제목" /></label>
      <label className="wide">문서 내용<textarea value={form.content} onChange={(event) => update({ ...form, content: event.target.value })} placeholder="문서 내용을 입력하세요." /></label>
    </div>
    <div className="template-note"><strong>{template.name}</strong><span>{template.description}</span></div>
    <TemplateFieldInputs fields={parseTemplateFields(template.fieldsJson)} values={form.fieldValues} onChange={(name, value) => update({ ...form, fieldValues: { ...form.fieldValues, [name]: value } })} />
  </>;
  return readOnly ? <fieldset disabled className="approval-form-readonly" aria-label="양식 미리보기 · 읽기 전용">{body}</fieldset> : body;
}
