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
import { LeaveRequestDetailView } from "./ApprovalLeaveParts";
import { ApprovalHistorySection, EquipmentWorkCompletionDetailView, PurchaseRequestDetailView, TrainingReportDetailView, TrainingRequestDetailView } from "./ApprovalPurchaseTrainingDetails";
import { EquipmentProposalDetailView } from "./ApprovalEquipmentProposalDetail";
import { ApprovalOpinionList, ClassicDraftDetailView, signatureDisplayName } from "./ApprovalClassicParts";
export function ApprovalDetailView({
  user,
  approval,
  templates,
  equipmentProposal,
  equipmentProposalLoading = false,
  equipmentCompletionReport,
  leaveExclusions = [],
  employees = [],
  onSavePurchaseDeliveryDate,
  onSubmitPurchaseApprovalLine,
  onSaveEquipment,
  onSubmitEquipmentStage,
  onAssignEquipmentAssignee
}: {
  user: User;
  approval: Approval;
  templates: ApprovalTemplateOption[];
  equipmentProposal?: EquipmentProposal | null;
  equipmentProposalLoading?: boolean;
  equipmentCompletionReport?: EquipmentReport | null;
  leaveExclusions?: LeaveExclusion[];
  employees?: Employee[];
  onSavePurchaseDeliveryDate?: (deliveryDate: string) => void;
  onSubmitPurchaseApprovalLine?: (agreementEmpIds: number[], approverEmpIds: number[]) => void;
  onSaveEquipment?: (next: Partial<EquipmentProposal>) => void;
  onSubmitEquipmentStage?: (stage: "pe" | "purchase", next: Partial<EquipmentProposal>) => void;
  onAssignEquipmentAssignee?: (type: "pe" | "purchase", empId: number) => void;
}) {
  if (isDraftTemplateCode(approval.templateCode)) {
    return <ClassicDraftDetailView approval={approval} templates={templates} />;
  }
  if (isLeaveTemplateCode(approval.templateCode) || isLeaveCancelTemplateCode(approval.templateCode)) {
    return <LeaveRequestDetailView approval={approval} exclusions={leaveExclusions} />;
  }
  if (isPurchaseTemplateCode(approval.templateCode)) {
    return <PurchaseRequestDetailView user={user} employees={employees} approval={approval} onSaveDeliveryDate={onSavePurchaseDeliveryDate} onSubmitPurchaseApprovalLine={onSubmitPurchaseApprovalLine} />;
  }
  if (isTrainingRequestTemplateCode(approval.templateCode)) {
    return <TrainingRequestDetailView user={user} employees={employees} approval={approval} onSubmitTrainingApprovalLine={onSubmitPurchaseApprovalLine} />;
  }
  if (isTrainingReportTemplateCode(approval.templateCode)) {
    return <TrainingReportDetailView user={user} employees={employees} approval={approval} onSubmitTrainingApprovalLine={onSubmitPurchaseApprovalLine} />;
  }
  if (approval.templateCode === "EQUIPMENT_WORK_COMPLETION") {
    return <EquipmentWorkCompletionDetailView approval={approval} report={equipmentCompletionReport} />;
  }
  if (isEquipmentProposalTemplateCode(approval.templateCode) && equipmentProposal) {
    return (
      <EquipmentProposalDetailView
        user={user}
        approval={approval}
        equipmentProposal={equipmentProposal}
        employees={employees}
        onSave={onSaveEquipment}
        onSubmitStage={onSubmitEquipmentStage}
        onAssign={onAssignEquipmentAssignee}
      />
    );
  }
  if (isEquipmentProposalTemplateCode(approval.templateCode)) {
    const title = equipmentProposalTitle(approval.templateCode);
    return (
      <article className="approval-detail equipment-proposal-detail">
        <section className="approval-detail-section">
          <h3>{title}</h3>
          <p className="muted-text">{equipmentProposalLoading ? `${title} 양식을 불러오는 중입니다.` : `${title} 양식을 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.`}</p>
        </section>
      </article>
    );
  }

  return (
    <article className="approval-detail">
      <section className="approval-detail-section">
        <h3>문서 기본정보</h3>
        <dl className="approval-meta-grid">
          <dt>문서번호</dt><dd>{approval.documentNo ?? "상신 시 자동 생성"}</dd>
          <dt>양식</dt><dd>{templateName(templates, approval.templateCode)} v{approval.templateVersion ?? "-"}</dd>
          <dt>중요도</dt><dd>{priorityLabel(approval.priority)}</dd>
          <dt>현재 단계</dt><dd>{stageLabel(approval.currentStage)}</dd>
          <dt>문서 상태</dt><dd>{statusLabel(approval.status)}</dd>
          <dt>수신 상태</dt><dd>{receiverProgress(approval.lines)}</dd>
          <dt>기안자</dt><dd>{approval.requesterName}</dd>
          <dt>기안부서</dt><dd>{approval.draftDeptName ?? approval.requesterDeptName ?? "-"}</dd>
          <dt>작성일</dt><dd>{formatDate(approval.requestedAt)}</dd>
          <dt>상신일</dt><dd>{approval.lastSubmittedAt ? formatDate(approval.lastSubmittedAt) : "-"}</dd>
          <dt>완료일</dt><dd>{approval.completedAt ? formatDate(approval.completedAt) : "-"}</dd>
          <dt>진행률</dt><dd>{approvalProgress(approval.lines)}</dd>
        </dl>
      </section>
      <section className="approval-detail-section">
        <h3>문서 내용</h3>
        <div className="detail-content">{approvalContent(approval) ? <RichContent content={approvalContent(approval)} /> : "내용이 없습니다."}</div>
      </section>
      <ApprovalHistorySection lines={approval.lines} />
      <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
      <section className="approval-detail-section">
        <h3>감사 이력</h3>
        <p className="muted-text">감사 로그는 관리자 감사 화면에서 문서 ID #{approval.approvalId} 기준으로 추적합니다.</p>
      </section>
    </article>
  );
}
