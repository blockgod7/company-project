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
  EquipmentReport,
  LeaveExclusion,
  LeaveUsage,
  PageResponse,
  User
} from "../types";
import { EquipmentProposalUserSection, MoldFixtureProposalUserSection } from "./ApprovalEquipmentProposalParts";
import { LeaveRequestDetailView } from "./ApprovalLeaveParts";
import { ApprovalOpinionList, ClassicDraftDetailView, signatureDisplayName } from "./ApprovalClassicParts";
import { emptyStampColumn, padStampColumns } from "./ApprovalStampUtils";
import type { StampDisplayColumn } from "./ApprovalStampUtils";
export function PurchaseDraftStampHeader({ user, employees, form }: { user: User; employees: Employee[]; form: ApprovalForm }) {
  const approvalColumns = [
    {
      key: "requester",
      position: "작성자",
      name: user.empName,
      date: "",
      muted: false,
      delegateText: null
    },
    ...employeesByIds(employees, form.approverEmpIds).map((employee) => ({
      key: `approver-${employee.empId}`,
      position: employee.positionName ?? "결재자",
      name: employee.empName,
      date: "",
      muted: false,
      delegateText: null
    }))
  ];
  const receiverColumns = employeesByIds(employees, form.receiverEmpIds).map((employee) => ({
    key: `receiver-${employee.empId}`,
    position: employee.positionName ?? "수신자",
    name: employee.empName,
    date: "",
    muted: false,
    delegateText: null
  }));

  return <PurchaseStampHeader approvalColumns={approvalColumns} receiverColumns={receiverColumns} />;
}

export function TrainingDraftStampHeader({ user, employees, form, title = "교육 신청서" }: { user: User; employees: Employee[]; form: ApprovalForm; title?: string }) {
  const approvalColumns = [
    {
      key: "requester",
      position: "작성자",
      name: user.empName,
      date: "",
      muted: false,
      delegateText: null
    },
    ...employeesByIds(employees, form.approverEmpIds).map((employee) => ({
      key: `training-approver-${employee.empId}`,
      position: employee.positionName ?? "결재자",
      name: employee.empName,
      date: "",
      muted: false,
      delegateText: null
    }))
  ];
  const receiverColumns = employeesByIds(employees, form.receiverEmpIds).map((employee) => ({
    key: `training-receiver-${employee.empId}`,
    position: employee.positionName ?? "수신자",
    name: employee.empName,
    date: "",
    muted: false,
    delegateText: null
  }));

  return (
    <div className="purchase-paper-stamp-head">
      <PurchaseStampTable label="신청부서" columns={approvalColumns} minCount={2} />
      <div className="purchase-paper-title">{title}</div>
      <div className="purchase-receiver-stamps">
        <PurchaseStampTable label="주관부서" columns={receiverColumns} minCount={1} />
      </div>
    </div>
  );
}

export function PurchaseApprovalStampHeader({
  approval,
  receiverApprovalPreviewColumns = []
}: {
  approval: Approval;
  receiverApprovalPreviewColumns?: StampDisplayColumn[];
}) {
  const receiverLines = approval.lines
    .filter((line) => line.lineType === "RECEIVER")
    .slice()
    .sort((a, b) => a.lineOrder - b.lineOrder);
  const firstReceiverOrder = receiverLines[0]?.lineOrder ?? Number.POSITIVE_INFINITY;
  const lastReceiverOrder = receiverLines[receiverLines.length - 1]?.lineOrder ?? Number.NEGATIVE_INFINITY;
  const requesterApprovalLines = approval.lines
    .filter((line) => line.lineType === "APPROVAL" && line.lineOrder < firstReceiverOrder)
    .slice()
    .sort((a, b) => a.lineOrder - b.lineOrder);
  const receiverDecisionLines = approval.lines
    .filter((line) => (line.lineType === "AGREEMENT" || line.lineType === "APPROVAL") && line.lineOrder > lastReceiverOrder)
    .slice()
    .sort((a, b) => a.lineOrder - b.lineOrder);
  const approvalColumns = [
    {
      key: "requester",
      position: approval.requesterPositionName ?? "작성자",
      name: approval.requesterName,
      date: approval.requestedAt,
      muted: false,
      delegateText: null
    },
    ...requesterApprovalLines.map(purchaseDecisionStampColumn)
  ];
  const receiverColumns = receiverLines.map((line) => ({
      key: String(line.lineId),
      position: line.positionSnapshot ?? line.approverPositionName ?? "수신자",
      name: line.empNameSnapshot ?? line.approverName,
      date: line.readAt ?? line.actedAt,
      muted: !line.readAt && !line.actedAt,
      delegateText: delegatedActionText(line)
    }));
  const receiverApprovalColumns = receiverDecisionLines.length
    ? receiverDecisionLines.map(purchaseDecisionStampColumn)
    : receiverApprovalPreviewColumns;

  return <PurchaseStampHeader approvalColumns={approvalColumns} receiverColumns={receiverColumns} receiverApprovalColumns={receiverApprovalColumns} />;
}

export function TrainingApprovalStampHeader({
  approval,
  receiverApprovalPreviewColumns = [],
  title = "교육 신청서"
}: {
  approval: Approval;
  receiverApprovalPreviewColumns?: StampDisplayColumn[];
  title?: string;
}) {
  const receiverLines = approval.lines
    .filter((line) => line.lineType === "RECEIVER")
    .slice()
    .sort((a, b) => a.lineOrder - b.lineOrder);
  const firstReceiverOrder = firstReceiverLineOrder(approval.lines);
  const lastReceiverOrder = lastReceiverLineOrder(approval.lines);
  const requesterApprovalLines = approval.lines
    .filter((line) => line.lineType === "APPROVAL" && line.lineOrder < firstReceiverOrder)
    .slice()
    .sort((a, b) => a.lineOrder - b.lineOrder);
  const receiverDecisionLines = approval.lines
    .filter((line) => (line.lineType === "AGREEMENT" || line.lineType === "APPROVAL") && line.lineOrder > lastReceiverOrder)
    .slice()
    .sort((a, b) => a.lineOrder - b.lineOrder);
  const approvalColumns = [
    {
      key: "requester",
      position: approval.requesterPositionName ?? "작성자",
      name: approval.requesterName,
      date: approval.requestedAt,
      muted: false,
      delegateText: null
    },
    ...requesterApprovalLines.map(purchaseDecisionStampColumn)
  ];
  const receiverColumns = receiverLines.map((line) => ({
    key: String(line.lineId),
    position: line.positionSnapshot ?? line.approverPositionName ?? "수신자",
    name: line.empNameSnapshot ?? line.approverName,
    date: line.readAt ?? line.actedAt,
    muted: !line.readAt && !line.actedAt,
    delegateText: delegatedActionText(line)
  }));
  const receiverApprovalColumns = receiverDecisionLines.length
    ? receiverDecisionLines.map(purchaseDecisionStampColumn)
    : receiverApprovalPreviewColumns;

  return (
    <div className="purchase-paper-stamp-head">
      <PurchaseStampTable label="신청부서" columns={approvalColumns} minCount={2} />
      <div className="purchase-paper-title">{title}</div>
      <div className="purchase-receiver-stamps">
        <PurchaseStampTable label="주관부서" columns={[...receiverColumns, ...receiverApprovalColumns]} minCount={1} />
      </div>
    </div>
  );
}

export function purchaseStampColumnsFromEmployees(employees: Employee[], ids: number[], prefix: string): StampDisplayColumn[] {
  return employeesByIds(employees, ids).map((employee) => ({
    key: `purchase-${prefix}-${employee.empId}`,
    position: employee.positionName ?? (prefix === "agreement" ? "합의자" : "결재자"),
    name: employee.empName,
    date: "",
    muted: false,
    delegateText: null
  }));
}

function purchaseDecisionStampColumn(line: ApprovalLine): StampDisplayColumn {
  return {
    key: String(line.lineId),
    position: line.positionSnapshot ?? line.approverPositionName ?? (line.lineType === "AGREEMENT" ? "합의자" : "결재자"),
    name: line.status === "APPROVED" || line.status === "REJECTED" ? signatureDisplayName(line) : line.empNameSnapshot ?? line.approverName,
    date: line.signedAt ?? line.actedAt,
    muted: line.status !== "APPROVED" && line.status !== "REJECTED",
    delegateText: delegatedActionText(line)
  };
}

function PurchaseStampHeader({
  title = "구매요구서",
  approvalLabel = "결재",
  receiverLabel = "수신",
  approvalColumns,
  receiverColumns,
  receiverApprovalColumns = []
}: {
  title?: string;
  approvalLabel?: string;
  receiverLabel?: string;
  approvalColumns: StampDisplayColumn[];
  receiverColumns: StampDisplayColumn[];
  receiverApprovalColumns?: StampDisplayColumn[];
}) {
  return (
    <div className="purchase-paper-stamp-head">
      <PurchaseStampTable label="결재" columns={approvalColumns} minCount={2} />
      <div className="purchase-paper-title">구매요구서</div>
      <div className="purchase-receiver-stamps">
        <PurchaseStampTable label="수신" columns={[...receiverColumns, ...receiverApprovalColumns]} minCount={1} />
      </div>
    </div>
  );
}

function PurchaseStampTable({ label, columns, minCount }: { label: string; columns: StampDisplayColumn[]; minCount: number }) {
  const visibleColumns = padStampColumns(columns, minCount);

  return (
    <div className="approval-stamp-wrap purchase-approval-stamp">
      <div className="approval-stamp-label">{label}</div>
      <div className="approval-stamp-table">
        {visibleColumns.map((column) => (
          <div className="approval-stamp-column" key={column.key}>
            <div className="stamp-position">{column.position}</div>
            <div className={`stamp-signature${column.muted ? " stamp-signature-muted" : ""}`}>{column.name}</div>
            <div className="stamp-date">
              {column.date ? formatDate(column.date) : ""}
              {column.delegateText && <span className="stamp-delegate">{column.delegateText}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
