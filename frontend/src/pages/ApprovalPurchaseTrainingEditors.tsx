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
import { BEREAVEMENT_EVENT_TYPES } from "../utils/bereavement";
import type { BereavementOption } from "../utils/bereavement";
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
  ApprovalHoliday,
  ApprovalDelegationApi,
  ApprovalDefaultLineApi,
  ApprovalDefaultLineStepApi,
  ApprovalLine,
  ApprovalOperationSettings,
  ApprovalSummary,
  ApprovalTemplateApi,
  AuditLog,
  CompTimeSummary,
  Employee,
  EquipmentProposal,
  LeaveExclusion,
  LeaveUsage,
  PageResponse,
  User
} from "../types";
import { PurchaseDraftStampHeader } from "./ApprovalPurchaseTrainingStamps";
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

export { TrainingRequestEditor, TrainingReportEditor } from "./ApprovalTrainingParts";

function requiredLabel(label: string) {
  return <>{label}<span className="required-mark"> *</span></>;
}
