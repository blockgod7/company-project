import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Check,
  ClipboardCheck,
  Download,
  Edit3,
  Eye,
  FileText,
  Flag,
  History,
  Inbox,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
  UserRound,
  X
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { api, authenticatedFetch, jsonBody } from "../api";
import schunkLogo from "../assets/schunk-carbon-logo.png";
import { ApprovalListTable, ApprovalRetentionAuditTable, DeletedApprovalListTable } from "../components/ApprovalTables";
import { CardHeader } from "../components/CardHeader";
import { AttachmentBox, DraftAttachmentPicker, EditorHeader, EditorTools, ReadDetail, RichContent } from "../components/ContentTools";
import { ApprovalLineTableEditor, EmployeeMultiPicker } from "../components/EmployeePickers";
import { Empty, EmptyDetail } from "../components/Empty";
import { DetailPage, ListSummary, Toolbar, TwoPane } from "../components/PageLayout";
import { uploadAttachments } from "../utils/attachments";
import type { DraftAttachment } from "../utils/attachments";
import {
  approvalProgress,
  delegatedActionText,
  documentPrefix,
  isDelegatedAction,
  lineActedName,
  lineAssignedName,
  lineDueText,
  lineStatusLabel,
  lineTypeLabel,
  priorityLabel,
  receiverProgress,
  retentionAuditActionLabel,
  stageLabel,
  statusLabel,
  templateName
} from "../utils/approvalLabels";
import {
  approvalContent,
  approvalDraftData,
  approvalLinePerson,
  approvalOpinionLines,
  approvalTemplateByCode,
  APPROVAL_TEMPLATE_CATEGORIES,
  blankMoldFixturePart,
  blankPurchaseItem,
  categorizedTemplateGroups,
  currentUserDeptName,
  DEFAULT_APPROVAL_SEARCH,
  DEFAULT_APPROVAL_TEMPLATES,
  DEFAULT_TOTAL_ANNUAL_DAYS,
  defaultApprovalForm,
  defaultDelegationForm,
  defaultLineIds,
  defaultLinePayload,
  defaultOperationSettingsForm,
  employeeDisplay,
  employeesByIds,
  ENABLE_TEMPLATE_FALLBACK,
  equipmentProposalCapacityLabel,
  equipmentProposalGeneratedTitle,
  equipmentProposalItemFallback,
  equipmentProposalItemLabel,
  equipmentProposalTitle,
  firstReceiverLineOrder,
  firstSelectableApprovalTemplate,
  formatApprovalLines,
  formatDayValue,
  formatEmployeeList,
  formatShortDate,
  idsFromJson,
  isDeptManagerUser,
  isDraftTemplateCode,
  isEquipmentProposalTemplateCode,
  isLeaveCancelTemplateCode,
  isLeaveTemplateCode,
  isMoldFixtureTemplateCode,
  isPurchaseTemplateCode,
  isReceiverRoutedTemplateCode,
  isRequiredTemplateField,
  isTrainingReportTemplateCode,
  isTrainingRequestTemplateCode,
  isTrainingTemplateCode,
  KOREAN_PUBLIC_HOLIDAYS,
  lastReceiverLineOrder,
  LEAVE_TYPE_OPTIONS,
  leaveCancelContent,
  leaveDateRangeText,
  leaveDayValue,
  leaveRequestContent,
  leaveSummary,
  leaveUsageFieldValues,
  localDateKey,
  moldFixturePartsJson,
  normalizeMoldFixtureParts,
  normalizePurchaseItems,
  parseLeaveSelections,
  parseMoldFixtureParts,
  parsePurchaseItems,
  parseTemplateFields,
  productionEngineeringManagerId,
  PURCHASE_BU_CODES,
  PURCHASE_RECEIVER_LOGIN_ID,
  purchaseBuTotal,
  purchaseDefaultFieldValues,
  purchaseItemsJson,
  purchaseReceiptDate,
  purchaseReceiverId,
  purchaseRequestContent,
  remainingAnnualDaysText,
  selectableApprovalTemplates,
  templateAdminFormFromOption,
  templateOptionFromApi,
  todayDate,
  TRAINING_RECEIVER_LOGIN_ID,
  trainingReceiverId,
  trainingReportContent,
  trainingReportDefaultFieldValues,
  trainingRequestClosingText,
  trainingRequestContent,
  trainingRequestDefaultFieldValues,
  validatePurchaseRequest,
  validateTrainingReport,
  validateTrainingRequest,
  withLeaveCancelTemplate
} from "../utils/approvalDomain";
import type {
  ApprovalBox,
  ApprovalBoxApi,
  ApprovalCategory,
  ApprovalDashboardFilter,
  ApprovalDelegationForm,
  ApprovalForm,
  ApprovalLaunch,
  ApprovalOperationSettingsForm,
  ApprovalSearchForm,
  ApprovalTemplateAdminForm,
  ApprovalTemplateCategory,
  ApprovalTemplateField,
  ApprovalTemplateOption,
  ContentMode,
  LeaveSelection,
  MoldFixturePart,
  PurchaseRequestItem
} from "../utils/approvalDomain";
import { formatDate } from "../utils/date";
import type { GlobalSearchTarget } from "../utils/search";
import type {
  Approval,
  ApprovalDelegationApi,
  ApprovalDefaultLineApi,
  ApprovalDefaultLineStepApi,
  ApprovalLine,
  ApprovalOperationSettings,
  ApprovalSummary,
  ApprovalTemplateApi,
  AuditLog,
  Employee,
  EquipmentProposal,
  LeaveUsage,
  PageResponse,
  User
} from "../types";
import { PurchaseDraftStampHeader, TrainingDraftStampHeader } from "./ApprovalParts";
export function TemplateFieldInputs({
  fields,
  values,
  onChange
}: {
  fields: ApprovalTemplateField[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  if (!fields.length) return null;
  return (
    <div className="template-field-grid">
      {fields.map((field) => {
        const required = isRequiredTemplateField(field);
        const label = required ? `${field.label} *` : field.label;
        if (field.type === "textarea") {
          return (
            <label key={field.name} className="wide">{label}
              <textarea value={values[field.name] ?? ""} onChange={(event) => onChange(field.name, event.target.value)} />
            </label>
          );
        }
        if (field.type === "select") {
          return (
            <label key={field.name}>{label}
              <select value={values[field.name] ?? ""} onChange={(event) => onChange(field.name, event.target.value)}>
                <option value="">선택</option>
                {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          );
        }
        return (
          <label key={field.name}>{label}
            <input
              type={field.type === "date" || field.type === "number" ? field.type : "text"}
              value={values[field.name] ?? ""}
              onChange={(event) => onChange(field.name, event.target.value)}
            />
          </label>
        );
      })}
    </div>
  );
}

export function PurchaseRequestEditor({ user, employees, form, onChange }: { user: User; employees: Employee[]; form: ApprovalForm; onChange: (form: ApprovalForm) => void }) {
  const values = purchaseDefaultFieldValues(user, employees, form.fieldValues);
  const items = parsePurchaseItems(values);
  const buTotal = purchaseBuTotal(values);

  function setField(name: string, value: string) {
    onChange({ ...form, fieldValues: { ...values, [name]: value } });
  }

  function setItem(index: number, name: keyof PurchaseRequestItem, value: string) {
    const nextItems = normalizePurchaseItems(items);
    nextItems[index] = { ...nextItems[index], [name]: value };
    onChange({ ...form, fieldValues: { ...values, purchaseItemsJson: purchaseItemsJson(nextItems) } });
  }

  function addItem() {
    onChange({ ...form, fieldValues: { ...values, purchaseItemsJson: purchaseItemsJson([...items, blankPurchaseItem()]) } });
  }

  function removeItem(index: number) {
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    onChange({ ...form, fieldValues: { ...values, purchaseItemsJson: purchaseItemsJson(nextItems.length ? nextItems : [blankPurchaseItem()]) } });
  }

  return (
    <div className="purchase-request-form">
      <div className="approval-form-grid">
        <label className="wide">{requiredLabel("문서 제목")}<input required value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="예: 구매요구서 - 안전장갑 외 3건 - 생산팀" /></label>
      </div>

      <div className="purchase-paper">
        <PurchaseDraftStampHeader user={user} employees={employees} form={form} />
        <div className="purchase-meta-grid">
          <label><span>부서명</span><input readOnly value={values.requestDeptName} /></label>
          <label><span>성명</span><input readOnly value={values.requesterName} /></label>
          <label><span>청구일</span><input readOnly type="date" value={values.requestDate} /></label>
          <label><span>{requiredLabel("요구일")}</span><input required type="date" value={values.requiredDate} onChange={(event) => setField("requiredDate", event.target.value)} /></label>
          <label><span>접수일</span><input readOnly value={values.receiptDate || "수신 확인 시 자동 기입"} /></label>
          <label><span>입고일</span><input readOnly value={values.deliveryDate || "구매부서 입력"} /></label>
        </div>

        <div className="purchase-items-head">
          <strong>품목 내역</strong>
          <button type="button" className="ghost" onClick={addItem}><Plus size={16} /> 행 추가</button>
        </div>
        <div className="purchase-item-table">
          <div className="purchase-item-row purchase-item-header">
            <span>품명</span><span>규격</span><span>수량</span><span>용도</span><span></span>
          </div>
          {items.map((item, index) => (
            <div className="purchase-item-row" key={index}>
              <input value={item.itemName} onChange={(event) => setItem(index, "itemName", event.target.value)} />
              <input value={item.spec} onChange={(event) => setItem(index, "spec", event.target.value)} />
              <input value={item.quantity} onChange={(event) => setItem(index, "quantity", event.target.value)} />
              <input value={item.usage} onChange={(event) => setItem(index, "usage", event.target.value)} />
              <button type="button" className="ghost danger" onClick={() => removeItem(index)} disabled={items.length === 1}><X size={15} /></button>
            </div>
          ))}
        </div>

        <div className="purchase-bu-section">
          <div className="purchase-items-head">
            <strong>BU 비용분할</strong>
            <span className={Math.abs(buTotal - 100) < 0.0001 ? "bu-total ok" : "bu-total"}>합계 {buTotal || 0}%</span>
          </div>
          <div className="purchase-bu-grid">
            {PURCHASE_BU_CODES.map((code) => (
              <label key={code}><span>{code}</span><input type="number" min="0" max="100" step="0.1" value={values[`bu_${code}`]} onChange={(event) => setField(`bu_${code}`, event.target.value)} /></label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function TrainingRequestEditor({ user, employees, form, onChange }: { user: User; employees: Employee[]; form: ApprovalForm; onChange: (form: ApprovalForm) => void }) {
  const values = trainingRequestDefaultFieldValues(user, employees, form.fieldValues);

  function setField(name: string, value: string) {
    onChange({ ...form, fieldValues: { ...values, [name]: value } });
  }

  return (
    <div className="training-request-form">
      <div className="approval-form-grid">
        <label className="wide">{requiredLabel("문서 제목")}<input required value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="예: 직무교육 - 교육신청서" /></label>
      </div>
      <section className="training-paper">
        <TrainingDraftStampHeader user={user} employees={employees} form={form} />
        <div className="training-person-row">
          <label><span>소속</span><input readOnly value={values.deptName} /></label>
          <label><span>직위</span><input readOnly value={values.positionName} /></label>
          <label><span>성명</span><input readOnly value={values.requesterName} /></label>
        </div>
        <div className="training-field-row">
          <label><span>교육명</span><input required value={values.trainingName} onChange={(event) => setField("trainingName", event.target.value)} /></label>
        </div>
        <div className="training-field-row">
          <label><span>교육기관</span><input required value={values.institution} onChange={(event) => setField("institution", event.target.value)} /></label>
        </div>
        <div className="training-field-row training-date-row">
          <label><span>교육 시작일</span><input type="date" value={values.trainingStartDate} onChange={(event) => setField("trainingStartDate", event.target.value)} /></label>
          <label><span>교육 종료일</span><input type="date" value={values.trainingEndDate} onChange={(event) => setField("trainingEndDate", event.target.value)} /></label>
        </div>
        <div className="training-reason-row">
          <label><span>사유(구체적)</span><textarea required value={values.reason} onChange={(event) => setField("reason", event.target.value)} /></label>
        </div>
        <div className="training-footer-text">
          <p>{trainingRequestClosingText(values)}</p>
          <div className="training-choice-group" role="radiogroup" aria-label="신청 구분">
            {["수강", "변경", "불참"].map((option) => (
              <label key={option}>
                <input type="radio" name="training-request-type" checked={values.requestType === option} onChange={() => setField("requestType", option)} />
                <span>{option}</span>
              </label>
            ))}
          </div>
          <p>{values.requestDate.slice(0, 4)} 년&nbsp;&nbsp; {values.requestDate.slice(5, 7)} 월&nbsp;&nbsp; {values.requestDate.slice(8, 10)} 일</p>
        </div>
      </section>
    </div>
  );
}

export function TrainingReportEditor({ user, employees, form, onChange }: { user: User; employees: Employee[]; form: ApprovalForm; onChange: (form: ApprovalForm) => void }) {
  const values = trainingReportDefaultFieldValues(user, employees, form.fieldValues);

  function setField(name: string, value: string) {
    onChange({ ...form, fieldValues: { ...values, [name]: value } });
  }

  return (
    <div className="training-request-form">
      <div className="approval-form-grid">
        <label className="wide">{requiredLabel("문서 제목")}<input required value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="예: 직무교육 - 교육훈련보고서" /></label>
      </div>
      <section className="training-paper training-report-paper">
        <TrainingDraftStampHeader user={user} employees={employees} form={form} title="교육 훈련 보고서" />
        <div className="training-report-meta-row">
          <label><span>작성일</span><input readOnly value={values.reportDate} /></label>
          <label><span>사번</span><input readOnly value={values.empNo} /></label>
          <label><span>성명</span><input readOnly value={values.requesterName} /></label>
        </div>
        <div className="training-report-two-col">
          <label><span>교육명</span><input required value={values.trainingName} onChange={(event) => setField("trainingName", event.target.value)} /></label>
          <label><span>교육기관</span><input required value={values.institution} onChange={(event) => setField("institution", event.target.value)} /></label>
        </div>
        <div className="training-field-row">
          <label><span>교육기간</span><input required value={values.trainingPeriod} onChange={(event) => setField("trainingPeriod", event.target.value)} /></label>
        </div>
        <TrainingReportTextArea label="주요교육 내용" value={values.mainContent} onChange={(value) => setField("mainContent", value)} />
        <TrainingReportTextArea label="업무수행 방안" value={values.jobApplication} onChange={(value) => setField("jobApplication", value)} />
        <TrainingReportTextArea label="교육 소감" value={values.impression} onChange={(value) => setField("impression", value)} />
        <TrainingReportTextArea compact label="차기에 받고 싶은 교육(업무효과가능)" value={values.nextTraining} onChange={(value) => setField("nextTraining", value)} />
        <div className="training-report-bottom-row">
          <label><span>유효성 평가<br />(시급,속도,균형)</span><textarea value={values.effectiveness} onChange={(event) => setField("effectiveness", event.target.value)} /></label>
          <label><span>총무<br />인사카드기록 확인</span><textarea value={values.hrRecordCheck} onChange={(event) => setField("hrRecordCheck", event.target.value)} /></label>
        </div>
        <div className="training-report-sign-row">
          <span>서명</span><input readOnly value={values.signatureName} />
        </div>
      </section>
    </div>
  );
}

function TrainingReportTextArea({ label, value, compact = false, onChange }: { label: string; value: string; compact?: boolean; onChange: (value: string) => void }) {
  return (
    <div className={`training-report-section-row${compact ? " compact" : ""}`}>
      <label>
        <span>{label}</span>
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
    </div>
  );
}

export function LeaveRequestEditor({ mode, user, employees, form, leaveUsage, onChange }: { mode: "request" | "cancel"; user: User; employees: Employee[]; form: ApprovalForm; leaveUsage: LeaveUsage | null; onChange: (form: ApprovalForm) => void }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const values = form.fieldValues;
  const selections = parseLeaveSelections(values);
  const cancelMode = mode === "cancel";
  const deptName = currentUserDeptName(user, employees, user.deptName ?? "");
  const requester = employees.find((employee) => employee.empId === user.empId);
  const annualDays = formatDayValue(values.days);
  const usedBefore = formatDayValue(leaveUsage?.usedAnnualDays ?? values.usedAnnualDays ?? "0");
  const totalDays = formatDayValue(leaveUsage?.totalAnnualDays ?? values.totalAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS);
  const remainingDays = cancelMode
    ? formatDayValue(Number(totalDays) - Number(usedBefore) + Number(annualDays))
    : remainingAnnualDaysText(totalDays, usedBefore, annualDays);

  function updateValues(nextValues: Record<string, string>) {
    onChange({
      ...form,
      title: form.title.trim() ? form.title : cancelMode ? "휴가 취소계" : "휴가계",
      content: cancelMode ? leaveCancelContent(nextValues) : leaveRequestContent(nextValues),
      fieldValues: nextValues
    });
  }

  function applySelections(nextSelections: LeaveSelection[]) {
    const sorted = [...nextSelections].sort((a, b) => a.date.localeCompare(b.date));
    const days = sorted.reduce((sum, selection) => sum + selection.days, 0);
    const nextValues = {
      ...values,
      startDate: sorted[0]?.date ?? "",
      endDate: sorted[sorted.length - 1]?.date ?? "",
      days: formatDayValue(days),
      annualLeaveDays: formatDayValue(days),
      usedAnnualDays: usedBefore,
      totalAnnualDays: totalDays,
      remainingAnnualDays: cancelMode ? formatDayValue(Number(totalDays) - Number(usedBefore) + days) : remainingAnnualDaysText(totalDays, usedBefore, days),
      leaveType: leaveSummary(sorted),
      leaveSelectionsJson: JSON.stringify(sorted)
    };
    updateValues(nextValues);
  }

  return (
    <div className="leave-request-editor">
      <div className="leave-paper">
        <h2>{cancelMode ? "휴가 취소계" : "휴가계 (연차, 반차, 교육 등)"}</h2>
        <div className="leave-paper-top">
          <LeaveStamp title="결재" writer={user.empName} approvers={employeesByIds(employees, form.approverEmpIds)} />
          <LeaveStamp title="수신" writer="" approvers={employeesByIds(employees, form.receiverEmpIds)} />
        </div>
        <div className="leave-meta">
          <span>신청자 : {user.empName}</span>
          <span>TEL :</span>
          <span>기 타 :</span>
          <span>부 서 : {deptName || "-"}</span>
          <span>직 급 : {requester?.positionName ?? requester?.jobTitle ?? "-"}</span>
          <span>신청일 : {todayDate()}</span>
        </div>
        <div className="leave-form-table">
          <div className="leave-label">제 목</div>
          <input className="leave-title-input" value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="휴가계" />
          <button type="button" className="leave-label leave-clickable" onClick={() => setCalendarOpen(true)}>
            <CalendarDays size={16} /> {cancelMode ? "취소기간" : "신청기간"}
          </button>
          <button type="button" className="leave-value leave-clickable" onClick={() => setCalendarOpen(true)}>{leaveDateRangeText(values)}</button>
          <button type="button" className="leave-label leave-clickable" onClick={() => setCalendarOpen(true)}>
            <CalendarDays size={16} /> {cancelMode ? "취소구분" : "신청구분"}
          </button>
          <button type="button" className="leave-value leave-clickable leave-kind-value" onClick={() => setCalendarOpen(true)}>{values.leaveType || (cancelMode ? "최종 결재 완료된 휴가 날짜만 선택하세요." : "달력에서 날짜와 구분을 선택하세요.")}</button>
          <div className="leave-label leave-wide-label">신청 전 연차사용 일수 / 총 연차일수</div>
          <div className="leave-value leave-days-value">
            <span>{usedBefore}</span><span>/</span><span>{totalDays}</span><span>일</span>
          </div>
          <div className="leave-label">{cancelMode ? "취소 연차일수" : "연차 사용일수"}</div>
          <div className="leave-value">{annualDays} 일</div>
          <div className="leave-label">{cancelMode ? "취소 후 잔여 연차일수" : "신청 후 잔여 연차일수"}</div>
          <div className="leave-value">{remainingDays} 일</div>
        </div>
      </div>
      <p className="muted-text">{cancelMode ? "최종 결재 완료된 휴가 날짜만 선택할 수 있고, 취소계 승인 후 연차가 복구됩니다." : "제목은 휴가계로 표시하고, 계산되는 일수는 연차/오전반차/오후반차만 반영됩니다."}</p>
      {calendarOpen && (
        <LeaveCalendarModal
          mode={mode}
          selections={selections}
          lockedSelections={leaveUsage?.selections ?? []}
          onCancel={() => setCalendarOpen(false)}
          onConfirm={(nextSelections) => {
            applySelections(nextSelections);
            setCalendarOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LeaveStamp({ title, writer, approvers }: { title: string; writer: string; approvers: Employee[] }) {
  const columns = [
    ...(writer ? [{ label: "작성", name: writer, position: "신청자" }] : []),
    ...approvers.map((employee, index) => ({
      label: title === "수신" ? "수신" : index === approvers.length - 1 ? "승인" : "검토",
      name: employee.empName,
      position: employee.positionName ?? employee.jobTitle ?? ""
    }))
  ];
  if (!columns.length) columns.push({ label: "", name: "", position: "" });
  const columnWidth = "72px";
  const maxWidth = `${34 + columns.length * 72}px`;
  return (
    <div className={`leave-stamp ${title === "수신" ? "align-right" : "align-left"}`} style={{ gridTemplateColumns: `34px repeat(${columns.length}, ${columnWidth})`, maxWidth }}>
      <div className="leave-stamp-side">{title}</div>
      {columns.map((column, index) => <div key={`head-${index}`} className="leave-stamp-cell head">{column.label}</div>)}
      {columns.map((column, index) => (
        <div key={`body-${index}`} className="leave-stamp-cell body">
          <span>{column.position}</span>
          <strong>{column.name}</strong>
        </div>
      ))}
    </div>
  );
}

function LeaveCalendarModal({ mode, selections, lockedSelections, onCancel, onConfirm }: { mode: "request" | "cancel"; selections: LeaveSelection[]; lockedSelections: LeaveUsage["selections"]; onCancel: () => void; onConfirm: (selections: LeaveSelection[]) => void }) {
  const initialDate = selections[0]?.date ? new Date(`${selections[0].date}T00:00:00`) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [draftSelections, setDraftSelections] = useState<LeaveSelection[]>(selections);
  const selectedMap = new Map(draftSelections.map((selection) => [selection.date, selection]));
  const lockedMap = new Map(lockedSelections.map((selection) => [selection.date, selection]));
  const cancelMode = mode === "cancel";
  const monthCells = calendarCells(visibleMonth);
  const totalDays = draftSelections.reduce((sum, selection) => sum + selection.days, 0);

  function moveMonth(delta: number) {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1));
  }

  function toggleDate(date: string) {
    const approvedSelection = lockedMap.get(date);
    if (cancelMode && !approvedSelection) {
      return;
    }
    if (!cancelMode && lockedMap.has(date)) {
      return;
    }
    if (selectedMap.has(date)) {
      setDraftSelections(draftSelections.filter((selection) => selection.date !== date));
      return;
    }
    if (cancelMode && approvedSelection) {
      setDraftSelections([...draftSelections, { date, type: approvedSelection.type, days: Number(approvedSelection.days || 0) }].sort((a, b) => a.date.localeCompare(b.date)));
      return;
    }
    setDraftSelections([...draftSelections, { date, type: "연차", days: 1 }].sort((a, b) => a.date.localeCompare(b.date)));
  }

  function changeType(date: string, type: string) {
    setDraftSelections(draftSelections.map((selection) => selection.date === date ? { ...selection, type, days: leaveDayValue(type) } : selection));
  }

  return (
    <div className="modal-backdrop">
      <div className="leave-calendar-modal">
        <div className="modal-head">
          <h2>신청일 선택</h2>
          <div className="leave-calendar-head-actions">
            <button type="button" onClick={() => onConfirm(draftSelections)}>확인</button>
            <button type="button" className="ghost icon-button" onClick={onCancel} aria-label="닫기"><X size={18} /></button>
          </div>
        </div>
        <div className="leave-calendar-toolbar">
          <button type="button" className="ghost" onClick={() => moveMonth(-1)}>이전</button>
          <strong>{visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월</strong>
          <button type="button" className="ghost" onClick={() => moveMonth(1)}>다음</button>
        </div>
        <div className="leave-calendar-grid">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => <div key={day} className="leave-calendar-week">{day}</div>)}
          {monthCells.map((cell) => {
            const selected = selectedMap.get(cell.date);
            const locked = lockedMap.get(cell.date);
            const unavailable = cancelMode && !locked;
            return (
              <button
                type="button"
                key={cell.date}
                className={`leave-calendar-day${cell.inMonth ? "" : " outside"}${cell.weekend ? " weekend" : ""}${cell.holidayName ? " holiday" : ""}${selected ? " selected" : ""}${!cancelMode && locked ? " locked" : ""}${unavailable ? " unavailable" : ""}`}
                onClick={() => toggleDate(cell.date)}
                disabled={Boolean(!cancelMode && locked) || unavailable}
              >
                <span>{cell.day}</span>
                {cell.holidayName && <em className="leave-calendar-holiday">{cell.holidayName}</em>}
                {cancelMode && locked && !selected && <strong className="leave-calendar-locked-type">{locked.type}</strong>}
                {!cancelMode && locked && <strong className="leave-calendar-locked-type">{locked.type}</strong>}
                {selected && cancelMode && <strong className="leave-calendar-locked-type">{selected.type}</strong>}
                {selected && !cancelMode && (
                  <select
                    className="leave-calendar-type-select"
                    value={selected.type}
                    aria-label={`${cell.date} 신청구분`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => changeType(cell.date, event.target.value)}
                  >
                    {LEAVE_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                )}
              </button>
            );
          })}
        </div>
        <div className="leave-selection-list">
          <div className="leave-selection-summary">선택 {draftSelections.length}일 · {cancelMode ? "취소 연차" : "연차 사용"} {formatDayValue(totalDays)}일</div>
          {lockedSelections.length > 0 && <p className="leave-locked-summary">결재 완료 {lockedSelections.length}일 · 이미 사용 {formatDayValue(lockedSelections.reduce((sum, selection) => sum + Number(selection.days || 0), 0))}일</p>}
          {draftSelections.length ? (
            <p className="leave-selection-inline-summary">{draftSelections.map((selection) => `${selection.date} ${selection.type}(${formatDayValue(selection.days)}일)`).join(", ")}</p>
          ) : <p className="muted-text">{cancelMode ? "최종 결재 완료된 휴가 날짜만 선택할 수 있습니다." : "달력에서 신청일을 선택하세요."}</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>취소</button>
          <button type="button" onClick={() => onConfirm(draftSelections)}>확인</button>
        </div>
      </div>
    </div>
  );
}

function calendarCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const date = localDateKey(current);
    const day = current.getDay();
    return {
      date,
      day: current.getDate(),
      inMonth: current.getMonth() === month.getMonth(),
      weekend: day === 0 || day === 6,
      holidayName: KOREAN_PUBLIC_HOLIDAYS[date] ?? ""
    };
  });
}

export function LeaveRequestDetailView({ approval }: { approval: Approval }) {
  const values = approvalDraftData(approval).fieldValues;
  const cancelMode = isLeaveCancelTemplateCode(approval.templateCode);
  const approvers = approval.lines.filter((line) => line.lineType === "APPROVAL").sort((a, b) => a.lineOrder - b.lineOrder);
  const receivers = approval.lines.filter((line) => line.lineType === "RECEIVER").sort((a, b) => a.lineOrder - b.lineOrder);
  const usedBefore = formatDayValue(values.usedAnnualDays ?? "0");
  const totalDays = formatDayValue(values.totalAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS);
  const remainingDays = formatDayValue(values.remainingAnnualDays ?? (cancelMode ? Number(totalDays) - Number(usedBefore) + Number(values.days ?? 0) : remainingAnnualDaysText(totalDays, usedBefore, values.days)));

  return (
    <article className="leave-request-detail">
      <div className="leave-paper">
        <h2>{cancelMode ? "휴가 취소계" : "휴가계 (연차, 반차, 교육 등)"}</h2>
        <div className="leave-paper-top">
          <LeaveDetailStamp title="결재" writerName={approval.requesterName} writerPosition={approval.requesterPositionName ?? "신청자"} lines={approvers} />
          <LeaveDetailStamp title="수신" writerName="" writerPosition="" lines={receivers} />
        </div>
        <div className="leave-meta">
          <span>신청자 : {approval.requesterName}</span>
          <span>TEL :</span>
          <span>기 타 :</span>
          <span>부 서 : {approval.draftDeptName ?? approval.requesterDeptName ?? "-"}</span>
          <span>직 급 : {approval.requesterPositionName ?? "-"}</span>
          <span>신청일 : {formatDate(approval.requestedAt).slice(0, 10)}</span>
        </div>
        <div className="leave-form-table">
          <div className="leave-label">제 목</div><div className="leave-value">{approval.title}</div>
          <div className="leave-label">{cancelMode ? "취소기간" : "신청기간"}</div><div className="leave-value">{leaveDateRangeText(values)}</div>
          <div className="leave-label">{cancelMode ? "취소구분" : "신청구분"}</div><div className="leave-value leave-kind-value">{values.leaveType || "-"}</div>
          <div className="leave-label leave-wide-label">신청 전 연차사용 일수 / 총 연차일수</div>
          <div className="leave-value leave-days-value"><span>{usedBefore}</span><span>/</span><span>{totalDays}</span><span>일</span></div>
          <div className="leave-label">{cancelMode ? "취소 연차일수" : "연차 사용일수"}</div><div className="leave-value">{formatDayValue(values.days)} 일</div>
          <div className="leave-label">{cancelMode ? "취소 후 잔여 연차일수" : "신청 후 잔여 연차일수"}</div><div className="leave-value">{remainingDays} 일</div>
        </div>
      </div>
    </article>
  );
}

function LeaveDetailStamp({ title, writerName, writerPosition, lines }: { title: string; writerName: string; writerPosition: string; lines: ApprovalLine[] }) {
  const columns = [
    ...(writerName ? [{ label: "작성", name: writerName, position: writerPosition, date: "" }] : []),
    ...lines.map((line, index) => ({
      label: title === "수신" ? "수신" : index === lines.length - 1 ? "승인" : "검토",
      name: line.status === "APPROVED" || line.status === "REJECTED" ? lineStatusLabel(line.status) : line.approverName,
      position: line.positionSnapshot ?? line.approverPositionName ?? "결재자",
      date: line.signedAt ? formatDate(line.signedAt).slice(0, 10) : ""
    }))
  ];
  if (!columns.length) columns.push({ label: "", name: "", position: "", date: "" });
  const columnWidth = "72px";
  const maxWidth = `${34 + columns.length * 72}px`;
  return (
    <div className={`leave-stamp ${title === "수신" ? "align-right" : "align-left"}`} style={{ gridTemplateColumns: `34px repeat(${columns.length}, ${columnWidth})`, maxWidth }}>
      <div className="leave-stamp-side">{title}</div>
      {columns.map((column, index) => <div key={`head-${index}`} className="leave-stamp-cell head">{column.label}</div>)}
      {columns.map((column, index) => (
        <div key={`body-${index}`} className="leave-stamp-cell body">
          <span>{column.position}</span>
          <strong>{column.name}</strong>
          <small>{column.date}</small>
        </div>
      ))}
    </div>
  );
}

export function EquipmentProposalEditor({ user, employees, form, onChange }: { user: User; employees: Employee[]; form: ApprovalForm; onChange: (form: ApprovalForm) => void }) {
  const requesterDeptName = currentUserDeptName(user, employees, form.fieldValues.requestDeptName ?? "");
  const proposalTitle = equipmentProposalTitle(form.templateCode);
  const generatedTitle = equipmentProposalGeneratedTitle(form.fieldValues, form.templateCode);
  const isAutoTitle = !form.title.trim() || form.title.trim() === proposalTitle || form.title.trim() === generatedTitle;
  function value(name: string) {
    if (name === "requestDeptName") return requesterDeptName;
    return form.fieldValues[name] ?? "";
  }
  function setValue(name: string, next: string) {
    const fieldValues = { ...form.fieldValues, requestDeptName: requesterDeptName, [name]: next };
    if (name === "moldPartsJson") {
      const firstPart = parseMoldFixtureParts(fieldValues)[0] ?? blankMoldFixturePart();
      fieldValues.partName = firstPart.partName;
      fieldValues.cavity = firstPart.cavity;
      fieldValues.material = firstPart.material;
      fieldValues.quantity = firstPart.quantity;
      fieldValues.moldNo = firstPart.moldNo;
    }
    const oldGeneratedTitle = equipmentProposalGeneratedTitle(form.fieldValues, form.templateCode);
    const shouldAutoTitle = !form.title.trim() || form.title === proposalTitle || form.title === oldGeneratedTitle;
    const title = (name === "equipmentName" || name === "moldNo" || name === "moldPartsJson" || name === "requestType") && shouldAutoTitle
      ? equipmentProposalGeneratedTitle(fieldValues, form.templateCode)
      : form.title;
    onChange({ ...form, title, content: equipmentProposalContent(fieldValues, form.templateCode), fieldValues });
  }

  return (
    <article className="approval-template-editor equipment-proposal-editor equipment-proposal-detail">
      <section className="approval-detail-section">
        <h3>{proposalTitle}</h3>
        <div className="approval-form-grid">
          <label className="wide">{requiredLabel("문서 제목")}<input className={isAutoTitle ? "auto-title-input" : ""} required value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder={isMoldFixtureTemplateCode(form.templateCode) ? "예: S-BB123 제작 품의서" : "예: 가공기-1 개선 품의서"} /></label>
        </div>
      </section>
      {isMoldFixtureTemplateCode(form.templateCode) ? (
        <MoldFixtureProposalUserSection value={value} onChange={setValue} />
      ) : (
        <EquipmentProposalUserSection templateCode={form.templateCode} value={value} onChange={setValue} />
      )}
    </article>
  );
}

export function EquipmentProposalUserSection({
  templateCode,
  value,
  onChange,
  readOnly = false,
  stamp,
  children
}: {
  templateCode?: string | null;
  value: (name: string) => string;
  onChange?: (name: string, next: string) => void;
  readOnly?: boolean;
  stamp?: ReactNode;
  children?: ReactNode;
}) {
  const change = (name: string) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    onChange?.(name, event.target.value);
  };
  const moldFixture = isMoldFixtureTemplateCode(templateCode);

  return (
    <section className="approval-detail-section">
      <div className="equipment-section-head">
        <h3>사용부서 작성란</h3>
        {stamp}
      </div>
      <div className="approval-form-grid">
        {moldFixture && (
          <>
            <label>{requiredLabel("품목")}
              <select required disabled={readOnly} value={value("moldFixtureType")} onChange={change("moldFixtureType")}>
                <option value="">선택</option>
                <option value="금형">금형</option>
                <option value="치공구">치공구</option>
              </select>
            </label>
            <label><span>고객사</span><input readOnly={readOnly} value={value("customerName")} onChange={change("customerName")} /></label>
            <label>{requiredLabel("제품(기종)명")}<input required readOnly={readOnly} value={value("productName")} onChange={change("productName")} /></label>
            <label><span>용도</span><input readOnly={readOnly} value={value("usageText")} onChange={change("usageText")} /></label>
          </>
        )}
        <label>{requiredLabel(moldFixture ? "사용부서" : "요청부서")}<input required readOnly value={value("requestDeptName")} title="작성자 소속부서로 자동 지정됩니다." /></label>
        <label>{requiredLabel("완료요구일")}<input required type="date" readOnly={readOnly} value={value("requiredCompletionDate")} onChange={change("requiredCompletionDate")} /></label>
        {!moldFixture && (
          <>
            <label>{requiredLabel(equipmentProposalItemLabel(templateCode))}<input required readOnly={readOnly} value={value("equipmentName")} onChange={change("equipmentName")} /></label>
            <label><span>{equipmentProposalCapacityLabel(templateCode)}</span><input readOnly={readOnly} value={value("equipmentCapacity")} onChange={change("equipmentCapacity")} /></label>
          </>
        )}
        <label>{requiredLabel("구분")}
          <select required disabled={readOnly} value={value("requestType")} onChange={change("requestType")}>
            <option value="">선택</option>
            {(moldFixture ? ["고객지급", "투자", "설계 및 제작", "구매", "수리", "매각", "폐기"] : ["구입", "제작", "개선", "수리", "매각", "폐기"]).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="wide">{requiredLabel(moldFixture ? "사유" : "현상")}<textarea required readOnly={readOnly} value={value("currentState")} onChange={change("currentState")} /></label>
        {moldFixture && (
          <>
            <label><span>부품명</span><input readOnly={readOnly} value={value("partName")} onChange={change("partName")} /></label>
            <label><span>CAVITY</span><input readOnly={readOnly} value={value("cavity")} onChange={change("cavity")} /></label>
            <label><span>재질</span><input readOnly={readOnly} value={value("material")} onChange={change("material")} /></label>
            <label><span>수량</span><input readOnly={readOnly} value={value("quantity")} onChange={change("quantity")} /></label>
            <label><span>금형번호</span><input readOnly={readOnly} value={value("moldNo")} onChange={change("moldNo")} /></label>
          </>
        )}
        <label className="wide">{requiredLabel("요구사항")}<textarea required={!moldFixture} readOnly={readOnly} value={value("requirements")} onChange={change("requirements")} /></label>
        <label className="wide"><span>지시 사항</span><textarea readOnly={readOnly} value={value("instructions")} onChange={change("instructions")} /></label>
        <label className="wide"><span>경제성 검토 - 사용부서</span><textarea readOnly={readOnly} value={value("userEconomicReview")} onChange={change("userEconomicReview")} /></label>
      </div>
      {children}
    </section>
  );
}

export function MoldFixtureProposalUserSection({
  value,
  onChange,
  readOnly = false,
  stamp,
  children
}: {
  value: (name: string) => string;
  onChange?: (name: string, next: string) => void;
  readOnly?: boolean;
  stamp?: ReactNode;
  children?: ReactNode;
}) {
  const change = (name: string) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    onChange?.(name, event.target.value);
  };

  return (
    <section className="approval-detail-section mold-fixture-section">
      <div className="equipment-section-head">
        <h3>사용부서 작성란</h3>
        {stamp}
      </div>
      <div className="mold-fixture-form">
        <label className="mold-item-type">{requiredLabel("품목")}
          <select required disabled={readOnly} value={value("moldFixtureType")} onChange={change("moldFixtureType")}>
            <option value="">선택</option>
            <option value="금형">금형</option>
            <option value="치공구">치공구</option>
          </select>
        </label>
        <label><span>고객사</span><input readOnly={readOnly} value={value("customerName")} onChange={change("customerName")} /></label>
        <label>{requiredLabel("제품(기종)명")}<input required readOnly={readOnly} value={value("productName")} onChange={change("productName")} /></label>
        <label>{requiredLabel("사용부서")}<input required readOnly value={value("requestDeptName")} title="작성자 소속부서로 자동 지정됩니다." /></label>
        <label><span>용도</span><input readOnly={readOnly} value={value("usageText")} onChange={change("usageText")} /></label>
        <label>{requiredLabel("완료요구일")}<input required type="date" readOnly={readOnly} value={value("requiredCompletionDate")} onChange={change("requiredCompletionDate")} /></label>
        <label className="mold-request-type">{requiredLabel("구분")}
          <select required disabled={readOnly} value={value("requestType")} onChange={change("requestType")}>
            <option value="">선택</option>
            {["고객지급", "투자", "설계 및 제작", "구매", "수리", "매각", "폐기"].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="mold-wide mold-reason">{requiredLabel("사유")}<textarea required readOnly={readOnly} value={value("currentState")} onChange={change("currentState")} /></label>

        <MoldFixturePartTable
          parts={parseMoldFixtureParts({
            moldPartsJson: value("moldPartsJson"),
            partName: value("partName"),
            cavity: value("cavity"),
            material: value("material"),
            quantity: value("quantity"),
            moldNo: value("moldNo")
          })}
          readOnly={readOnly}
          onChange={(parts) => onChange?.("moldPartsJson", moldFixturePartsJson(parts))}
        />

        <label className="mold-half"><span>요구사항</span><textarea readOnly={readOnly} value={value("requirements")} onChange={change("requirements")} /></label>
        <label className="mold-half"><span>지시사항</span><textarea readOnly={readOnly} value={value("instructions")} onChange={change("instructions")} /></label>
        <label className="mold-wide mold-economic"><span>경제성 검토 - 사용부서</span><textarea readOnly={readOnly} value={value("userEconomicReview")} onChange={change("userEconomicReview")} /></label>
      </div>
      {children}
    </section>
  );
}

function MoldFixturePartTable({
  parts,
  readOnly,
  onChange
}: {
  parts: MoldFixturePart[];
  readOnly: boolean;
  onChange: (parts: MoldFixturePart[]) => void;
}) {
  const rows = normalizeMoldFixtureParts(parts);
  const update = (index: number, field: keyof MoldFixturePart, value: string) => {
    const next = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row);
    onChange(next);
  };
  const add = () => onChange([...rows, blankMoldFixturePart()]);
  const remove = (index: number) => onChange(rows.length === 1 ? [blankMoldFixturePart()] : rows.filter((_, rowIndex) => rowIndex !== index));

  return (
    <div className={`mold-part-table mold-wide${readOnly ? " readonly" : ""}`}>
      <div className="mold-part-title">부품 정보</div>
      <div className={`mold-part-grid${readOnly ? " readonly" : ""}`}>
        <div className="mold-part-header">부품명</div>
        <div className="mold-part-header">CAVITY</div>
        <div className="mold-part-header">재질</div>
        <div className="mold-part-header">수량</div>
        <div className="mold-part-header">금형번호</div>
        {!readOnly && <div className="mold-part-header">관리</div>}
        {rows.map((part, index) => (
          <div className="mold-part-row" key={index}>
            <input readOnly={readOnly} value={part.partName} onChange={(event) => update(index, "partName", event.target.value)} />
            <input readOnly={readOnly} value={part.cavity} onChange={(event) => update(index, "cavity", event.target.value)} />
            <input readOnly={readOnly} value={part.material} onChange={(event) => update(index, "material", event.target.value)} />
            <input readOnly={readOnly} value={part.quantity} onChange={(event) => update(index, "quantity", event.target.value)} />
            <input readOnly={readOnly} value={part.moldNo} onChange={(event) => update(index, "moldNo", event.target.value)} />
            {!readOnly && (
              <button type="button" className="ghost mold-part-remove" onClick={() => remove(index)}>
                <Trash2 size={14} /> 삭제
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button type="button" className="ghost mold-part-add" onClick={add}>
            <Plus size={14} /> 부품 추가
          </button>
        )}
      </div>
    </div>
  );
}

function requiredLabel(label: string) {
  return <span className="required-label">{label}<em>필수</em></span>;
}

export function equipmentProposalContent(values: Record<string, string>, templateCode?: string | null) {
  if (isMoldFixtureTemplateCode(templateCode)) {
    return [
      `품목: ${values.moldFixtureType ?? ""}`,
      `고객사: ${values.customerName ?? ""}`,
      `제품(기종)명: ${values.productName ?? ""}`,
      `사용부서: ${values.requestDeptName ?? ""}`,
      `용도: ${values.usageText ?? ""}`,
      `완료요구일: ${values.requiredCompletionDate ?? ""}`,
      `구분: ${values.requestType ?? ""}`,
      "",
      "[사유]",
      values.currentState ?? "",
      "",
      "[부품 정보]",
      `부품명: ${values.partName ?? ""}`,
      `CAVITY: ${values.cavity ?? ""}`,
      `재질: ${values.material ?? ""}`,
      `수량: ${values.quantity ?? ""}`,
      `금형번호: ${values.moldNo ?? ""}`,
      "",
      "[요구사항]",
      values.requirements ?? "",
      "",
      "[지시 사항]",
      values.instructions ?? "",
      "",
      "[경제성 검토 - 사용부서]",
      values.userEconomicReview ?? ""
    ].join("\n");
  }
  return [
    `요청부서: ${values.requestDeptName ?? ""}`,
    `${equipmentProposalItemLabel(templateCode)}: ${values.equipmentName ?? ""}`,
    `완료요구일: ${values.requiredCompletionDate ?? ""}`,
    `구분: ${values.requestType ?? ""}`,
    "",
    "[현상]",
    values.currentState ?? "",
    "",
    "[요구사항]",
    values.requirements ?? "",
    "",
    "[지시 사항]",
    values.instructions ?? "",
    "",
    "[경제성 검토 - 사용부서]",
    values.userEconomicReview ?? ""
  ].join("\n");
}
