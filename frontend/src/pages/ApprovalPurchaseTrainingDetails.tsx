import { PurchaseDocumentOverview, PurchaseDocumentFields } from "./ApprovalPurchaseParts";
import { ApprovalInfoModal } from "./ApprovalInfoModal";
import { useApprovalLineLibrary } from "./useApprovalLineLibrary";
import type { ApprovalLineSelection } from "../utils/approvalPeople";
import { TrainingDocumentOverview, TrainingDocumentFields } from "./ApprovalTrainingParts";
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
import {
  PurchaseApprovalStampHeader,
  TrainingApprovalStampHeader,
  purchaseStampColumnsFromEmployees
} from "./ApprovalPurchaseTrainingStamps";
export function EquipmentWorkCompletionDetailView({ approval, report }: { approval: Approval; report?: EquipmentReport | null }) {
  const fields = approvalFormFields(approval.formDataJson);
  return (
    <article className="approval-detail">
      <section className="approval-detail-section">
        <h3>작업 요청 내용</h3>
        {report ? <dl className="approval-meta-grid">
          <dt>설비</dt><dd>{report.equipmentName}</dd>
          <dt>요청 제목</dt><dd>{report.title}</dd>
          <dt>이상 증상</dt><dd>{report.symptom}</dd>
          <dt>요청 내용</dt><dd>{report.requestContent}</dd>
          <dt>요청자</dt><dd>{report.reporterName}</dd>
          <dt>발생일</dt><dd>{report.occurredOn ?? "-"}</dd>
        </dl> : <p className="muted-text">원본 작업 요청을 불러오지 못했습니다.</p>}
      </section>
      <section className="approval-detail-section">
        <h3>작업 처리 내용</h3>
        <dl className="approval-meta-grid">
          <dt>작업 결과</dt><dd>{report?.workResult ?? fieldText(fields.workResult)}</dd>
          <dt>원인 분석</dt><dd>{report?.causeAnalysis ?? fieldText(fields.causeAnalysis)}</dd>
          <dt>조치 내용</dt><dd>{report?.actionTaken ?? fieldText(fields.actionTaken)}</dd>
          <dt>완료 일자</dt><dd>{report?.completedOn ?? "-"}</dd>
          <dt>소요 시간</dt><dd>{report?.workDurationHours != null ? `${report.workDurationHours}시간` : "-"}</dd>
        </dl>
      </section>
      <ApprovalLineSection title="결재자" lines={approval.lines.filter((line) => line.lineType === "APPROVAL")} />
      <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
    </article>
  );
}
function approvalFormFields(formDataJson: string | null): Record<string, unknown> {
  if (!formDataJson) return {};
  try {
    const parsed = JSON.parse(formDataJson);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function fieldText(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "-";
}

export function PurchaseRequestDetailView({
  user, employees, approval, onSaveDeliveryDate, onSubmitPurchaseApprovalLine
}: {
  user: User;
  employees: Employee[];
  approval: Approval;
  onSaveDeliveryDate?: (deliveryDate: string) => void;
  onSubmitPurchaseApprovalLine?: (agreementEmpIds: number[], approverEmpIds: number[]) => void;
}) {
  const draftData = approvalDraftData(approval);
  const fields: Record<string, string> = {
    ...draftData.fieldValues,
    requestDeptName: draftData.fieldValues.requestDeptName || approval.draftDeptName || approval.requesterDeptName || "",
    requesterName: draftData.fieldValues.requesterName || approval.requesterName,
    requestDate: draftData.fieldValues.requestDate || (approval.requestedAt ?? "").slice(0, 10),
    receiptDate: draftData.fieldValues.receiptDate || purchaseReceiptDate(approval.lines).slice(0, 10)
  };
  const receiverLine = approval.lines.find((line) => line.lineType === "RECEIVER" && (line.assignedEmpId ?? line.approverEmpId) === user.empId);
  const purchaseReceiverStage = approval.status === "IN_PROGRESS" && approval.currentStage === "RECEIVER_PROGRESS";
  const canEditDeliveryDate = (approval.status === "APPROVED" || purchaseReceiverStage) && !!receiverLine;
  const canSubmitPurchaseApproval = purchaseReceiverStage && !!receiverLine && (receiverLine.status === "RECEIVED" || receiverLine.status === "READ");
  const [deliveryDate, setDeliveryDate] = useState(fields.deliveryDate ?? "");
  const [purchaseAgreementEmpIds, setPurchaseAgreementEmpIds] = useState<number[]>([]);
  const [purchaseApproverEmpIds, setPurchaseApproverEmpIds] = useState<number[]>([]);
  const [purchaseApprovalInfoOpen, setPurchaseApprovalInfoOpen] = useState(false);

  useEffect(() => {
    setDeliveryDate(fields.deliveryDate ?? "");
  }, [approval.approvalId, fields.deliveryDate]);
  useEffect(() => {
    setPurchaseAgreementEmpIds([]);
    setPurchaseApproverEmpIds([]);
    setPurchaseApprovalInfoOpen(false);
  }, [approval.approvalId]);

  return <article className="approval-detail purchase-request-detail purchase-web-detail">
    <PurchaseDocumentOverview values={fields} actions={canSubmitPurchaseApproval ? (
      <div className="actions approval-editor-actions">
        <button type="button" className="ghost" onClick={() => setPurchaseApprovalInfoOpen(true)}><Edit3 size={16} /> 결재 정보</button>
        <button type="button" className="purchase-approval-submit" disabled={!purchaseApproverEmpIds.length}
          title={!purchaseApproverEmpIds.length ? "결재 정보에서 결재자를 한 명 이상 지정해 주세요." : undefined}
          onClick={() => onSubmitPurchaseApprovalLine?.(purchaseAgreementEmpIds, purchaseApproverEmpIds)}><Check size={16} /> 구매팀 결재 상신</button>
      </div>
    ) : undefined}>
      <div className="purchase-document-status">
        <span>문서번호<strong>{approval.documentNo ?? "상신 후 자동 생성"}</strong></span>
        <span>문서상태<strong>{statusLabel(approval.status)}</strong></span>
        <span>수신상태<strong>{receiverProgress(approval.lines)}</strong></span>
      </div>
    </PurchaseDocumentOverview>
    <ReceiverApprovalInfoModal open={canSubmitPurchaseApproval && purchaseApprovalInfoOpen}
      user={user} employees={employees} agreementEmpIds={purchaseAgreementEmpIds} approverEmpIds={purchaseApproverEmpIds}
      onAgreementChange={setPurchaseAgreementEmpIds} onApproverChange={setPurchaseApproverEmpIds}
      description="구매팀 내부 결재선입니다. 합의자와 결재자를 지정한 뒤 적용하세요."
      onClose={() => setPurchaseApprovalInfoOpen(false)} />
    <PurchaseDocumentFields values={{ ...fields, deliveryDate }} title={approval.title}
      onDeliveryDateChange={canEditDeliveryDate ? setDeliveryDate : undefined}
      onSaveDeliveryDate={canEditDeliveryDate ? () => onSaveDeliveryDate?.(deliveryDate) : undefined} />
    <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
  </article>;
}

export function TrainingRequestDetailView({
  user,
  employees,
  approval,
  onSubmitTrainingApprovalLine
}: {
  user: User;
  employees: Employee[];
  approval: Approval;
  onSubmitTrainingApprovalLine?: (agreementEmpIds: number[], approverEmpIds: number[]) => void;
}) {
  const draftData = approvalDraftData(approval);
  const fields: Record<string, string> = {
    ...draftData.fieldValues,
    deptName: draftData.fieldValues.deptName || approval.draftDeptName || approval.requesterDeptName || "",
    positionName: draftData.fieldValues.positionName || approval.requesterPositionName || "",
    requesterName: draftData.fieldValues.requesterName || approval.requesterName,
    requestType: draftData.fieldValues.requestType || "수강"
  };
  const receiverLine = approval.lines.find((line) => line.lineType === "RECEIVER" && (line.assignedEmpId ?? line.approverEmpId) === user.empId);
  const receiverStage = approval.status === "IN_PROGRESS" && approval.currentStage === "RECEIVER_PROGRESS";
  const canSubmitTrainingApproval = receiverStage
    && !!receiverLine
    && (receiverLine.status === "RECEIVED" || receiverLine.status === "READ");
  const [trainingAgreementEmpIds, setTrainingAgreementEmpIds] = useState<number[]>([]);
  const [trainingApproverEmpIds, setTrainingApproverEmpIds] = useState<number[]>([]);
  const [trainingApprovalInfoOpen, setTrainingApprovalInfoOpen] = useState(false);
  const receiverApprovalPreviewColumns = canSubmitTrainingApproval
    ? [
        ...purchaseStampColumnsFromEmployees(employees, trainingAgreementEmpIds, "agreement"),
        ...purchaseStampColumnsFromEmployees(employees, trainingApproverEmpIds, "approval")
      ]
    : [];

  return (
    <article className="approval-detail training-web-detail">
      <TrainingDocumentOverview
        mode={approval.templateCode === "TRAINING_CHANGE" ? "change" : "request"}
        values={fields}
        readOnly
        actions={canSubmitTrainingApproval ? (
          <div className="actions approval-editor-actions">
            <button type="button" className="ghost" onClick={() => setTrainingApprovalInfoOpen(true)}><Edit3 size={16} /> 결재 정보</button>
            <button
              type="button"
              className="training-approval-submit"
              disabled={!trainingApproverEmpIds.length}
              title={!trainingApproverEmpIds.length ? "결재 정보에서 결재자를 한 명 이상 지정해 주세요." : undefined}
              onClick={() => onSubmitTrainingApprovalLine?.(trainingAgreementEmpIds, trainingApproverEmpIds)}
            ><Check size={16} /> 주관부서 결재 상신</button>
          </div>
        ) : undefined}
      >
        <div className="training-document-meta">
          <div><span>문서 제목</span><strong>{approval.title}</strong></div>
          <div><span>문서번호</span><strong>{approval.documentNo ?? "상신 후 자동 생성"}</strong></div>
          <div><span>문서상태</span><strong>{statusLabel(approval.status)}</strong></div>
          <div><span>수신상태</span><strong>{receiverProgress(approval.lines)}</strong></div>
        </div>
      </TrainingDocumentOverview>
      <ReceiverApprovalInfoModal
        open={canSubmitTrainingApproval && trainingApprovalInfoOpen}
        user={user}
        employees={employees}
        agreementEmpIds={trainingAgreementEmpIds}
        approverEmpIds={trainingApproverEmpIds}
        onAgreementChange={setTrainingAgreementEmpIds}
        onApproverChange={setTrainingApproverEmpIds}
        onClose={() => setTrainingApprovalInfoOpen(false)}
      />
      {fields.sourceTrainingApprovalId && <section className="training-web-card"><h3>연결된 원 교육신청서</h3><p>{fields.sourceTrainingDocumentNo || fields.sourceTrainingApprovalId}</p><p>{fields.previousTrainingName} · {fields.previousInstitution} · {fields.previousStartDate} ~ {fields.previousEndDate}</p>{fields.changeAction && <strong>{fields.changeAction === "CANCEL" ? "교육 취소" : "교육 변경"}</strong>}</section>}
      <TrainingDocumentFields mode={approval.templateCode === "TRAINING_CHANGE" ? "change" : "request"} values={fields} />
      <details className="training-web-card training-signatures">
        <summary>결재 진행 내역 보기</summary>
        <TrainingApprovalStampHeader approval={approval} receiverApprovalPreviewColumns={receiverApprovalPreviewColumns} title="교육 신청서" />
        <ApprovalLineSection title="신청부서 결재" lines={approval.lines.filter((line) => line.lineType === "APPROVAL" && line.lineOrder < firstReceiverLineOrder(approval.lines))} />
        <ApprovalLineSection title="주관부서 수신/결재" lines={approval.lines.filter((line) => line.lineType === "RECEIVER" || line.lineOrder > lastReceiverLineOrder(approval.lines))} />
        <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
      </details>
    </article>
  );
}

export function TrainingReportDetailView({
  user,
  employees,
  approval,
  onSubmitTrainingApprovalLine
}: {
  user: User;
  employees: Employee[];
  approval: Approval;
  onSubmitTrainingApprovalLine?: (agreementEmpIds: number[], approverEmpIds: number[]) => void;
}) {
  const draftData = approvalDraftData(approval);
  const fields: Record<string, string> = {
    ...draftData.fieldValues,
    deptName: draftData.fieldValues.deptName || approval.draftDeptName || approval.requesterDeptName || "",
    positionName: draftData.fieldValues.positionName || approval.requesterPositionName || "",
    requesterName: draftData.fieldValues.requesterName || approval.requesterName,
    signatureName: draftData.fieldValues.signatureName || approval.requesterName
  };
  const receiverLine = approval.lines.find((line) => line.lineType === "RECEIVER" && (line.assignedEmpId ?? line.approverEmpId) === user.empId);
  const receiverStage = approval.status === "IN_PROGRESS" && approval.currentStage === "RECEIVER_PROGRESS";
  const canSubmitTrainingApproval = fields.educationWorkflowVersion !== "1" && receiverStage
    && !!receiverLine
    && (receiverLine.status === "RECEIVED" || receiverLine.status === "READ");
  const [trainingAgreementEmpIds, setTrainingAgreementEmpIds] = useState<number[]>([]);
  const [trainingApproverEmpIds, setTrainingApproverEmpIds] = useState<number[]>([]);
  const [trainingApprovalInfoOpen, setTrainingApprovalInfoOpen] = useState(false);
  const receiverApprovalPreviewColumns = canSubmitTrainingApproval
    ? [
        ...purchaseStampColumnsFromEmployees(employees, trainingAgreementEmpIds, "agreement"),
        ...purchaseStampColumnsFromEmployees(employees, trainingApproverEmpIds, "approval")
      ]
    : [];

  return (
    <article className="approval-detail training-web-detail">
      <TrainingDocumentOverview
        mode="report"
        values={fields}
        readOnly
        actions={canSubmitTrainingApproval ? (
          <div className="actions approval-editor-actions">
            <button type="button" className="ghost" onClick={() => setTrainingApprovalInfoOpen(true)}><Edit3 size={16} /> 결재 정보</button>
            <button
              type="button"
              className="training-approval-submit"
              disabled={!trainingApproverEmpIds.length}
              title={!trainingApproverEmpIds.length ? "결재 정보에서 결재자를 한 명 이상 지정해 주세요." : undefined}
              onClick={() => onSubmitTrainingApprovalLine?.(trainingAgreementEmpIds, trainingApproverEmpIds)}
            ><Check size={16} /> 주관부서 결재 상신</button>
          </div>
        ) : undefined}
      >
        <div className="training-document-meta">
          <div><span>문서 제목</span><strong>{approval.title}</strong></div>
          <div><span>문서번호</span><strong>{approval.documentNo ?? "상신 후 자동 생성"}</strong></div>
          <div><span>문서상태</span><strong>{statusLabel(approval.status)}</strong></div>
          <div><span>수신상태</span><strong>{receiverProgress(approval.lines)}</strong></div>
        </div>
      </TrainingDocumentOverview>
      <ReceiverApprovalInfoModal
        open={canSubmitTrainingApproval && trainingApprovalInfoOpen}
        user={user}
        employees={employees}
        agreementEmpIds={trainingAgreementEmpIds}
        approverEmpIds={trainingApproverEmpIds}
        onAgreementChange={setTrainingAgreementEmpIds}
        onApproverChange={setTrainingApproverEmpIds}
        onClose={() => setTrainingApprovalInfoOpen(false)}
      />
      {fields.educationWorkflowVersion === "1" && <section className="training-web-card"><h3>교육 보고서 접수</h3><p>원 교육신청서: {fields.sourceTrainingDocumentNo || fields.sourceTrainingApprovalId}</p><p>작성부서 결재 후 수신자가 접수 완료하면 문서와 교육 이수가 완료됩니다. 주관부서 추가 결재는 없습니다.</p></section>}
      <TrainingDocumentFields mode="report" values={fields} />
      <details className="training-web-card training-signatures">
        <summary>결재 진행 내역 보기</summary>
        <TrainingApprovalStampHeader approval={approval} receiverApprovalPreviewColumns={receiverApprovalPreviewColumns} title="교육 훈련 보고서" />
        <ApprovalLineSection title="작성부서 결재" lines={approval.lines.filter((line) => line.lineType === "APPROVAL" && line.lineOrder < firstReceiverLineOrder(approval.lines))} />
        <ApprovalLineSection title={fields.educationWorkflowVersion === "1" ? "주관부서 접수" : "주관부서 수신/결재"} lines={approval.lines.filter((line) => line.lineType === "RECEIVER" || line.lineOrder > lastReceiverLineOrder(approval.lines))} />
        <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
      </details>
    </article>
  );
}

function ReceiverApprovalInfoModal({
  open,
  user,
  employees,
  agreementEmpIds,
  approverEmpIds,
  onAgreementChange,
  onApproverChange,
  description = "주관부서 결재선입니다. 합의자와 결재자를 지정한 뒤 적용하세요.",
  onClose
}: {
  open: boolean;
  user: User;
  employees: Employee[];
  agreementEmpIds: number[];
  approverEmpIds: number[];
  onAgreementChange: (ids: number[]) => void;
  onApproverChange: (ids: number[]) => void;
  description?: string;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selection: ApprovalLineSelection = {
    agreementEmpIds, approverEmpIds, receiverEmpIds: [], referenceEmpIds: [], readerEmpIds: []
  };
  const applySelection = (next: ApprovalLineSelection) => {
    onAgreementChange(next.agreementEmpIds);
    onApproverChange(next.approverEmpIds);
  };
  const library = useApprovalLineLibrary({
    selection, onApply: applySelection, setApprovalError: setError, setDefaultLineMessage: setMessage
  });
  useEffect(() => {
    if (open) void library.loadSavedApprovalLines();
  }, [open, library.loadSavedApprovalLines]);

  return <ApprovalInfoModal
    open={open}
    user={user}
    employees={employees}
    selection={selection}
    onChange={applySelection}
    library={library}
    decisionOnly
    description={description}
    error={error}
    message={message}
    onClose={onClose}
  />;
}

function ApprovalLineSection({ title, lines }: { title: string; lines: ApprovalLine[] }) {
  return (
    <section className="approval-detail-section">
      <h3>{title}</h3>
      {lines.length ? (
        <div className="approval-lines compact">
          {lines.slice().sort((a, b) => a.lineOrder - b.lineOrder).map((line, index) => (
            <div className="approval-line" key={line.lineId}>
              <strong>{index + 1}. {line.empNameSnapshot ?? line.approverName}</strong>
              <span>{line.deptNameSnapshot ?? line.approverDeptName ?? "-"} · {line.positionSnapshot ?? line.approverPositionName ?? "-"} · {line.lineType === "REFERENCE" ? (line.readAt ? "읽음" : "미열람") : lineStatusLabel(line.status)}</span>
              {lineDueText(line) && <span className="due-text">{lineDueText(line)}</span>}
              {delegatedActionText(line) && (
                <span className="delegated-action-text">
                  <b>대리 처리</b> {delegatedActionText(line)}
                </span>
              )}
              {line.comment && <p>{line.comment}</p>}
            </div>
          ))}
        </div>
      ) : <Empty text={`${title}가 없습니다.`} />}
    </section>
  );
}

export function ApprovalHistorySection({ lines }: { lines: ApprovalLine[] }) {
  const decisionLines = lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL").slice().sort((a, b) => a.lineOrder - b.lineOrder);
  const receiverLines = lines.filter((line) => line.lineType === "RECEIVER");
  const referenceLines = lines.filter((line) => line.lineType === "REFERENCE");
  const readerLines = lines.filter((line) => line.lineType === "READER");
  return (
    <section className="approval-detail-section approval-history-section">
      <h3>결재 현황 및 이력</h3>
      <div className="approval-history-list">
        <div className="approval-history-row"><strong>1. 기안</strong><span>기안자</span><span>문서 작성</span></div>
        {decisionLines.map((line, index) => (
          <div className="approval-history-row" key={line.lineId}>
            <strong>{index + 2}. {lineTypeLabel(line.lineType)}</strong>
            <span>{line.empNameSnapshot ?? line.approverName}</span>
            <span>{lineStatusLabel(line.status)}{line.comment ? ` · ${line.comment}` : ""}</span>
          </div>
        ))}
        {receiverLines.length > 0 && <div className="approval-history-row shared"><strong>수신</strong><span>{receiverLines.map((line) => line.empNameSnapshot ?? line.approverName).join(", ")}</span><span>최종 결재 완료 후 수신</span></div>}
        {referenceLines.map((line) => <div className="approval-history-row shared" key={line.lineId}><strong>참조</strong><span>{line.empNameSnapshot ?? line.approverName}</span><span>{line.readAt ? `읽음 · ${formatDate(line.readAt)}` : "미열람 · 상신 이후 열람 가능"}</span></div>)}
        {readerLines.length > 0 && <div className="approval-history-row shared"><strong>연람</strong><span>{readerLines.map((line) => line.empNameSnapshot ?? line.approverName).join(", ")}</span><span>결재라인 완료 후 열람 가능</span></div>}
      </div>
    </section>
  );
}

export function ApprovalReferenceReadStatus({ lines }: { lines: ApprovalLine[] }) {
  const references = lines.filter((line) => line.lineType === "REFERENCE");
  if (!references.length) return null;
  return (
    <details className="approval-detail-section">
      <summary>참조 열람 현황</summary>
      <div className="approval-history-list">
        {references.map((line) => (
          <div className="approval-history-row shared" key={line.lineId}>
            <strong>참조</strong>
            <span>{line.empNameSnapshot ?? line.approverName}</span>
            <span>{line.readAt ? `읽음 · ${formatDate(line.readAt)}` : "미열람"}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
