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
  EquipmentReport,
  LeaveUsage,
  PageResponse,
  User
} from "../types";
import { EquipmentProposalUserSection, LeaveRequestDetailView, MoldFixtureProposalUserSection } from "./ApprovalFormParts";
import { ApprovalOpinionList, ClassicDraftDetailView, signatureDisplayName } from "./ApprovalClassicParts";
export function ApprovalDetailView({
  user,
  approval,
  templates,
  equipmentProposal,
  equipmentProposalLoading = false,
  equipmentCompletionReport,
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
    return <LeaveRequestDetailView approval={approval} />;
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
      <ApprovalLineSection title="합의자" lines={approval.lines.filter((line) => line.lineType === "AGREEMENT")} />
      <ApprovalLineSection title="결재자" lines={approval.lines.filter((line) => line.lineType === "APPROVAL")} />
      <ApprovalLineSection title="수신자" lines={approval.lines.filter((line) => line.lineType === "RECEIVER")} />
      <ApprovalLineSection title="참조자" lines={approval.lines.filter((line) => line.lineType === "REFERENCE")} />
      <ApprovalLineSection title="연람자" lines={approval.lines.filter((line) => line.lineType === "READER")} />
      <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
      <section className="approval-detail-section">
        <h3>감사 이력</h3>
        <p className="muted-text">감사 로그는 관리자 감사 화면에서 문서 ID #{approval.approvalId} 기준으로 추적합니다.</p>
      </section>
    </article>
  );
}

function EquipmentWorkCompletionDetailView({ approval, report }: { approval: Approval; report?: EquipmentReport | null }) {
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

function PurchaseRequestDetailView({
  user,
  employees,
  approval,
  onSaveDeliveryDate,
  onSubmitPurchaseApprovalLine
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
  const items = parsePurchaseItems(fields).filter((item) => Object.values(item).some((value) => value.trim()));
  const receiverLine = approval.lines.find((line) => line.lineType === "RECEIVER" && (line.assignedEmpId ?? line.approverEmpId) === user.empId);
  const purchaseReceiverStage = approval.status === "IN_PROGRESS" && approval.currentStage === "RECEIVER_PROGRESS";
  const canEditDeliveryDate = (approval.status === "APPROVED" || purchaseReceiverStage) && !!receiverLine;
  const canSubmitPurchaseApproval = purchaseReceiverStage
    && !!receiverLine
    && (receiverLine.status === "RECEIVED" || receiverLine.status === "READ");
  const [deliveryDate, setDeliveryDate] = useState(fields.deliveryDate ?? "");
  const [purchaseAgreementEmpIds, setPurchaseAgreementEmpIds] = useState<number[]>([]);
  const [purchaseApproverEmpIds, setPurchaseApproverEmpIds] = useState<number[]>([]);
  const purchaseApprovalPreviewColumns = canSubmitPurchaseApproval
    ? [
        ...purchaseStampColumnsFromEmployees(employees, purchaseAgreementEmpIds, "agreement"),
        ...purchaseStampColumnsFromEmployees(employees, purchaseApproverEmpIds, "approval")
      ]
    : [];

  useEffect(() => {
    setDeliveryDate(fields.deliveryDate ?? "");
  }, [approval.approvalId, fields.deliveryDate]);

  return (
    <article className="approval-detail purchase-request-detail">
      <section className="approval-detail-section">
        <h3>구매요구서</h3>
        <dl className="approval-meta-grid">
          <dt>문서번호</dt><dd>{approval.documentNo ?? "상신 후 자동 생성"}</dd>
          <dt>문서상태</dt><dd>{statusLabel(approval.status)}</dd>
          <dt>수신상태</dt><dd>{receiverProgress(approval.lines)}</dd>
          <dt>기안자</dt><dd>{approval.requesterName}</dd>
        </dl>
      </section>
      {canSubmitPurchaseApproval && (
        <section className="approval-detail-section purchase-approval-submit-section">
          <div className="panel-head">
            <div>
              <h3>구매팀 결재 상신</h3>
              <p className="muted-text">구매팀 내부 결재라인을 지정해 상신하면 해당 결재 완료 후 문서가 최종 완료됩니다.</p>
            </div>
            <button type="button" onClick={() => onSubmitPurchaseApprovalLine?.(purchaseAgreementEmpIds, purchaseApproverEmpIds)}><Check size={16} /> 구매팀 결재 상신</button>
          </div>
          <div className="line-picker-grid">
            <EmployeeMultiPicker
              title="구매팀 합의자"
              user={user}
              employees={employees}
              selectedIds={purchaseAgreementEmpIds}
              disabledIds={[user.empId, ...purchaseApproverEmpIds]}
              onChange={setPurchaseAgreementEmpIds}
            />
            <EmployeeMultiPicker
              title="구매팀 결재자"
              user={user}
              employees={employees}
              selectedIds={purchaseApproverEmpIds}
              disabledIds={[user.empId, ...purchaseAgreementEmpIds]}
              ordered
              onChange={setPurchaseApproverEmpIds}
            />
          </div>
        </section>
      )}
      <section className="purchase-paper read-only">
        <PurchaseApprovalStampHeader approval={approval} receiverApprovalPreviewColumns={purchaseApprovalPreviewColumns} />
        <div className="purchase-meta-grid">
          <label><span>부서명</span><input readOnly value={fields.requestDeptName ?? ""} /></label>
          <label><span>성명</span><input readOnly value={fields.requesterName ?? ""} /></label>
          <label><span>청구일</span><input readOnly value={fields.requestDate ?? ""} /></label>
          <label><span>요구일</span><input readOnly value={fields.requiredDate ?? ""} /></label>
          <label><span>접수일</span><input readOnly value={fields.receiptDate || "-"} /></label>
          <label><span>입고일</span><input type="date" readOnly={!canEditDeliveryDate} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
        </div>
        {canEditDeliveryDate && (
          <div className="purchase-delivery-actions">
            <button type="button" onClick={() => onSaveDeliveryDate?.(deliveryDate)}><Save size={16} /> 입고일 저장</button>
          </div>
        )}
        <div className="purchase-item-table">
          <div className="purchase-item-row purchase-item-header">
            <span>품명</span><span>규격</span><span>수량</span><span>용도</span><span></span>
          </div>
          {(items.length ? items : [blankPurchaseItem()]).map((item, index) => (
            <div className="purchase-item-row" key={index}>
              <span>{item.itemName || "-"}</span>
              <span>{item.spec || "-"}</span>
              <span>{item.quantity || "-"}</span>
              <span>{item.usage || "-"}</span>
              <span></span>
            </div>
          ))}
        </div>
        <div className="purchase-bu-section">
          <div className="purchase-items-head"><strong>BU 비용분할</strong><span className="bu-total ok">합계 {purchaseBuTotal(fields)}%</span></div>
          <div className="purchase-bu-grid">
            {PURCHASE_BU_CODES.map((code) => (
              <label key={code}><span>{code}</span><input readOnly value={fields[`bu_${code}`] || "0"} /></label>
            ))}
          </div>
        </div>
      </section>
      <ApprovalLineSection title="합의자" lines={approval.lines.filter((line) => line.lineType === "AGREEMENT")} />
      <ApprovalLineSection title="결재자" lines={approval.lines.filter((line) => line.lineType === "APPROVAL")} />
      <ApprovalLineSection title="수신자" lines={approval.lines.filter((line) => line.lineType === "RECEIVER")} />
      <ApprovalLineSection title="참조자" lines={approval.lines.filter((line) => line.lineType === "REFERENCE")} />
      <ApprovalLineSection title="열람자" lines={approval.lines.filter((line) => line.lineType === "READER")} />
      <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
    </article>
  );
}

function TrainingRequestDetailView({
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
  const fields = trainingRequestDefaultFieldValues(user, employees, {
    ...draftData.fieldValues,
    deptName: draftData.fieldValues.deptName || approval.draftDeptName || approval.requesterDeptName || "",
    requesterName: draftData.fieldValues.requesterName || approval.requesterName
  });
  const receiverLine = approval.lines.find((line) => line.lineType === "RECEIVER" && (line.assignedEmpId ?? line.approverEmpId) === user.empId);
  const receiverStage = approval.status === "IN_PROGRESS" && approval.currentStage === "RECEIVER_PROGRESS";
  const canSubmitTrainingApproval = receiverStage
    && !!receiverLine
    && (receiverLine.status === "RECEIVED" || receiverLine.status === "READ");
  const [trainingAgreementEmpIds, setTrainingAgreementEmpIds] = useState<number[]>([]);
  const [trainingApproverEmpIds, setTrainingApproverEmpIds] = useState<number[]>([]);
  const receiverApprovalPreviewColumns = canSubmitTrainingApproval
    ? [
        ...purchaseStampColumnsFromEmployees(employees, trainingAgreementEmpIds, "agreement"),
        ...purchaseStampColumnsFromEmployees(employees, trainingApproverEmpIds, "approval")
      ]
    : [];

  return (
    <article className="approval-detail training-request-detail">
      <section className="approval-detail-section">
        <h3>교육신청서</h3>
        <dl className="approval-meta-grid">
          <dt>문서번호</dt><dd>{approval.documentNo ?? "상신 후 자동 생성"}</dd>
          <dt>문서상태</dt><dd>{statusLabel(approval.status)}</dd>
          <dt>수신상태</dt><dd>{receiverProgress(approval.lines)}</dd>
          <dt>기안자</dt><dd>{approval.requesterName}</dd>
        </dl>
      </section>
      {canSubmitTrainingApproval && (
        <section className="approval-detail-section purchase-approval-submit-section">
          <div className="panel-head">
            <div>
              <h3>주관부서 결재 상신</h3>
              <p className="muted-text">수신자가 주관부서 결재라인을 지정해 상신하면 해당 결재가 끝난 뒤 문서가 최종 완료됩니다.</p>
            </div>
            <button type="button" onClick={() => onSubmitTrainingApprovalLine?.(trainingAgreementEmpIds, trainingApproverEmpIds)}><Check size={16} /> 주관부서 결재 상신</button>
          </div>
          <div className="line-picker-grid">
            <EmployeeMultiPicker
              title="주관부서 합의자"
              user={user}
              employees={employees}
              selectedIds={trainingAgreementEmpIds}
              disabledIds={[user.empId, ...trainingApproverEmpIds]}
              onChange={setTrainingAgreementEmpIds}
            />
            <EmployeeMultiPicker
              title="주관부서 결재자"
              user={user}
              employees={employees}
              selectedIds={trainingApproverEmpIds}
              disabledIds={[user.empId, ...trainingAgreementEmpIds]}
              ordered
              onChange={setTrainingApproverEmpIds}
            />
          </div>
        </section>
      )}
      <section className="training-paper read-only">
        <TrainingApprovalStampHeader approval={approval} receiverApprovalPreviewColumns={receiverApprovalPreviewColumns} />
        <div className="training-person-row">
          <label><span>소속</span><input readOnly value={fields.deptName} /></label>
          <label><span>직위</span><input readOnly value={fields.positionName} /></label>
          <label><span>성명</span><input readOnly value={fields.requesterName} /></label>
        </div>
        <div className="training-field-row">
          <label><span>교육명</span><input readOnly value={fields.trainingName} /></label>
        </div>
        <div className="training-field-row">
          <label><span>교육기관</span><input readOnly value={fields.institution} /></label>
        </div>
        <div className="training-reason-row">
          <label><span>사유(구체적)</span><textarea readOnly value={fields.reason} /></label>
        </div>
        <div className="training-footer-text">
          <p>{trainingRequestClosingText(fields)}</p>
          <div className="training-choice-group read-only">
            {["수강", "변경", "불참"].map((option) => (
              <span key={option}>{option}({fields.requestType === option ? "●" : " "})</span>
            ))}
          </div>
          <p>{fields.requestDate.slice(0, 4)} 년&nbsp;&nbsp; {fields.requestDate.slice(5, 7)} 월&nbsp;&nbsp; {fields.requestDate.slice(8, 10)} 일</p>
        </div>
      </section>
      <ApprovalLineSection title="신청부서 결재" lines={approval.lines.filter((line) => line.lineType === "APPROVAL" && line.lineOrder < firstReceiverLineOrder(approval.lines))} />
      <ApprovalLineSection title="주관부서 수신/결재" lines={approval.lines.filter((line) => line.lineType === "RECEIVER" || line.lineOrder > lastReceiverLineOrder(approval.lines))} />
      <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
    </article>
  );
}

function TrainingReportDetailView({
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
  const fields = trainingReportDefaultFieldValues(user, employees, {
    ...draftData.fieldValues,
    requesterName: draftData.fieldValues.requesterName || approval.requesterName
  });
  const receiverLine = approval.lines.find((line) => line.lineType === "RECEIVER" && (line.assignedEmpId ?? line.approverEmpId) === user.empId);
  const receiverStage = approval.status === "IN_PROGRESS" && approval.currentStage === "RECEIVER_PROGRESS";
  const canSubmitTrainingApproval = receiverStage
    && !!receiverLine
    && (receiverLine.status === "RECEIVED" || receiverLine.status === "READ");
  const [trainingAgreementEmpIds, setTrainingAgreementEmpIds] = useState<number[]>([]);
  const [trainingApproverEmpIds, setTrainingApproverEmpIds] = useState<number[]>([]);
  const receiverApprovalPreviewColumns = canSubmitTrainingApproval
    ? [
        ...purchaseStampColumnsFromEmployees(employees, trainingAgreementEmpIds, "agreement"),
        ...purchaseStampColumnsFromEmployees(employees, trainingApproverEmpIds, "approval")
      ]
    : [];

  return (
    <article className="approval-detail training-request-detail">
      <section className="approval-detail-section">
        <h3>교육훈련보고서</h3>
        <dl className="approval-meta-grid">
          <dt>문서번호</dt><dd>{approval.documentNo ?? "상신 후 자동 생성"}</dd>
          <dt>문서상태</dt><dd>{statusLabel(approval.status)}</dd>
          <dt>수신상태</dt><dd>{receiverProgress(approval.lines)}</dd>
          <dt>기안자</dt><dd>{approval.requesterName}</dd>
        </dl>
      </section>
      {canSubmitTrainingApproval && (
        <section className="approval-detail-section purchase-approval-submit-section">
          <div className="panel-head">
            <div>
              <h3>주관부서 결재 상신</h3>
              <p className="muted-text">수신자가 주관부서 결재라인을 지정해 상신하면 해당 결재가 끝난 뒤 문서가 최종 완료됩니다.</p>
            </div>
            <button type="button" onClick={() => onSubmitTrainingApprovalLine?.(trainingAgreementEmpIds, trainingApproverEmpIds)}><Check size={16} /> 주관부서 결재 상신</button>
          </div>
          <div className="line-picker-grid">
            <EmployeeMultiPicker
              title="주관부서 합의자"
              user={user}
              employees={employees}
              selectedIds={trainingAgreementEmpIds}
              disabledIds={[user.empId, ...trainingApproverEmpIds]}
              onChange={setTrainingAgreementEmpIds}
            />
            <EmployeeMultiPicker
              title="주관부서 결재자"
              user={user}
              employees={employees}
              selectedIds={trainingApproverEmpIds}
              disabledIds={[user.empId, ...trainingAgreementEmpIds]}
              ordered
              onChange={setTrainingApproverEmpIds}
            />
          </div>
        </section>
      )}
      <section className="training-paper training-report-paper read-only">
        <TrainingApprovalStampHeader approval={approval} receiverApprovalPreviewColumns={receiverApprovalPreviewColumns} title="교육 훈련 보고서" />
        <div className="training-report-meta-row">
          <label><span>작성일</span><input readOnly value={fields.reportDate} /></label>
          <label><span>사번</span><input readOnly value={fields.empNo} /></label>
          <label><span>성명</span><input readOnly value={fields.requesterName} /></label>
        </div>
        <div className="training-report-two-col">
          <label><span>교육명</span><input readOnly value={fields.trainingName} /></label>
          <label><span>교육기관</span><input readOnly value={fields.institution} /></label>
        </div>
        <div className="training-field-row">
          <label><span>교육기간</span><input readOnly value={fields.trainingPeriod} /></label>
        </div>
        <TrainingReportReadOnlyArea label="주요교육 내용" value={fields.mainContent} />
        <TrainingReportReadOnlyArea label="업무수행 방안" value={fields.jobApplication} />
        <TrainingReportReadOnlyArea label="교육 소감" value={fields.impression} />
        <TrainingReportReadOnlyArea compact label="차기에 받고 싶은 교육(업무효과가능)" value={fields.nextTraining} />
        <div className="training-report-bottom-row">
          <label><span>유효성 평가<br />(시급,속도,균형)</span><textarea readOnly value={fields.effectiveness} /></label>
          <label><span>총무<br />인사카드기록 확인</span><textarea readOnly value={fields.hrRecordCheck} /></label>
        </div>
        <div className="training-report-sign-row">
          <span>서명</span><input readOnly value={fields.signatureName} />
        </div>
      </section>
      <ApprovalLineSection title="작성부서 결재" lines={approval.lines.filter((line) => line.lineType === "APPROVAL" && line.lineOrder < firstReceiverLineOrder(approval.lines))} />
      <ApprovalLineSection title="주관부서 수신/결재" lines={approval.lines.filter((line) => line.lineType === "RECEIVER" || line.lineOrder > lastReceiverLineOrder(approval.lines))} />
      <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
    </article>
  );
}

function TrainingReportReadOnlyArea({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`training-report-section-row${compact ? " compact" : ""}`}>
      <label>
        <span>{label}</span>
        <textarea readOnly value={value} />
      </label>
    </div>
  );
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
              <span>{line.deptNameSnapshot ?? line.approverDeptName ?? "-"} · {line.positionSnapshot ?? line.approverPositionName ?? "-"} · {lineStatusLabel(line.status)}</span>
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

function PurchaseApprovalStampHeader({
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

function TrainingApprovalStampHeader({
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

function purchaseStampColumnsFromEmployees(employees: Employee[], ids: number[], prefix: string): StampDisplayColumn[] {
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

function EquipmentProposalDetailView({
  user,
  approval,
  equipmentProposal,
  employees,
  onSave,
  onSubmitStage,
  onAssign
}: {
  user: User;
  approval: Approval;
  equipmentProposal: EquipmentProposal;
  employees: Employee[];
  onSave?: (next: Partial<EquipmentProposal>) => void;
  onSubmitStage?: (stage: "pe" | "purchase", next: Partial<EquipmentProposal>) => void;
  onAssign?: (type: "pe" | "purchase", empId: number) => void;
}) {
  const [draft, setDraft] = useState<EquipmentProposal>(equipmentProposal);
  const [peApproverIds, setPeApproverIds] = useState<number[]>([]);
  const [purchaseAgreementIds, setPurchaseAgreementIds] = useState<number[]>([]);
  const [purchaseApproverIds, setPurchaseApproverIds] = useState<number[]>([]);

  useEffect(() => {
    setDraft(equipmentProposal);
    const peManagerId = productionEngineeringManagerId(employees);
    setPeApproverIds(peManagerId ? [peManagerId] : []);
    setPurchaseApproverIds(equipmentProposal.purchaseAssigneeEmpId ? [equipmentProposal.purchaseAssigneeEmpId] : []);
  }, [equipmentProposal, employees]);

  const peEmployees = employees.filter((employee) => employee.deptName === "생산기술");
  const purchaseEmployees = employees.filter((employee) => employee.deptName === "구매");
  const canAssignPe = draft.canAssignPe && isDeptManagerUser(user, employees, "생산기술");
  const purchaseAgreementDisabledIds = [approval.requesterEmpId, draft.purchaseAssigneeEmpId, ...purchaseApproverIds].filter((id): id is number => typeof id === "number");
  const approvalGroups = equipmentApprovalGroups(approval, draft);
  const proposalTitle = equipmentProposalTitle(approval.templateCode);
  const moldFixture = isMoldFixtureTemplateCode(approval.templateCode);

  function change<K extends keyof EquipmentProposal>(key: K, value: EquipmentProposal[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <article className="approval-detail equipment-proposal-detail">
      <section className="approval-detail-section">
        <h3>{proposalTitle}</h3>
        <dl className="approval-meta-grid">
          <dt>문서번호</dt><dd>{approval.documentNo ?? "상신 시 자동 생성"}</dd>
          <dt>제목</dt><dd>{approval.title}</dd>
          <dt>단계</dt><dd>{equipmentStageLabel(draft.workflowStage)}</dd>
          <dt>기안자</dt><dd>{approval.requesterName}</dd>
          <dt>기안부서</dt><dd>{approval.draftDeptName ?? approval.requesterDeptName ?? "-"}</dd>
        </dl>
      </section>

      {moldFixture ? (
        <MoldFixtureProposalUserSection
          readOnly
          value={(name) => String(draft[name as keyof EquipmentProposal] ?? "")}
          stamp={<EquipmentSectionStamp requester={approval} lines={approvalGroups.userLines} />}
        >
          <AttachmentBox targetType="APPROVAL_EQUIPMENT_USER" targetId={approval.approvalId} readOnly={!draft.canEditUserSection} canDownload={!!approval.permissions?.canDownloadAttachment} />
        </MoldFixtureProposalUserSection>
      ) : (
        <EquipmentProposalUserSection
          templateCode={approval.templateCode}
          readOnly
          value={(name) => String(draft[name as keyof EquipmentProposal] ?? "")}
          stamp={<EquipmentSectionStamp requester={approval} lines={approvalGroups.userLines} />}
        >
          <AttachmentBox targetType="APPROVAL_EQUIPMENT_USER" targetId={approval.approvalId} readOnly={!draft.canEditUserSection} canDownload={!!approval.permissions?.canDownloadAttachment} />
        </EquipmentProposalUserSection>
      )}

      <section className="approval-detail-section">
        <div className="equipment-section-head">
          <h3>주관부서 작성란</h3>
          <EquipmentSectionStamp leadLine={approvalGroups.peSubmitterLine} lines={approvalGroups.peLines} />
        </div>
        {draft.canEditPeSection && (
          <div className="section-top-actions">
            <button type="button" className="ghost" onClick={() => onSave?.(draft)}><Save size={16} /> 저장</button>
            <button type="button" onClick={() => onSubmitStage?.("pe", { ...draft, approverEmpIds: peApproverIds })}><Check size={16} /> 주관부서 결재 요청</button>
          </div>
        )}
        {canAssignPe && (
          <label className="equipment-assignee-picker"><span>생산기술 담당자</span>
            <select value={draft.peAssigneeEmpId ?? ""} onChange={(event) => event.target.value && onAssign?.("pe", Number(event.target.value))}>
              <option value="">담당자 선택</option>
              {peEmployees.map((employee) => <option key={employee.empId} value={employee.empId}>{employee.empName} · {employee.positionName ?? "-"}</option>)}
            </select>
          </label>
        )}
        <div className="approval-form-grid">
          <label className="wide"><span>주관부서(PE) 의견</span><textarea value={draft.peOpinion ?? ""} readOnly={!draft.canEditPeSection} onChange={(event) => change("peOpinion", event.target.value)} /></label>
          <label className="wide"><span>설계 의견</span><textarea value={draft.designOpinion ?? ""} readOnly={!draft.canEditPeSection} onChange={(event) => change("designOpinion", event.target.value)} /></label>
          <label className="wide"><span>경제성 검토 - 주관 부서</span><textarea value={draft.peEconomicReview ?? ""} readOnly={!draft.canEditPeSection} onChange={(event) => change("peEconomicReview", event.target.value)} /></label>
        </div>
        {draft.canEditPeSection && (
          <EmployeeMultiPicker
            title="주관부서 결재자"
            user={{ empId: approval.requesterEmpId, empName: approval.requesterName, deptName: approval.requesterDeptName, roleCode: "USER" } as User}
            employees={employees}
            selectedIds={peApproverIds}
            disabledIds={[]}
            ordered
            onChange={setPeApproverIds}
          />
        )}
        <AttachmentBox targetType="APPROVAL_EQUIPMENT_PE" targetId={approval.approvalId} readOnly={!draft.canEditPeSection} canDownload={!!approval.permissions?.canDownloadAttachment} />
      </section>

      <section className="approval-detail-section">
        <div className="equipment-section-head">
          <h3>구매부서 작성란</h3>
          <EquipmentSectionStamp leadLine={approvalGroups.purchaseSubmitterLine} lines={approvalGroups.purchaseLines} />
        </div>
        {draft.canEditPurchaseSection && (
          <div className="section-top-actions">
            <button type="button" className="ghost" onClick={() => onSave?.(draft)}><Save size={16} /> 저장</button>
            <button type="button" onClick={() => onSubmitStage?.("purchase", { ...draft, agreementEmpIds: purchaseAgreementIds, approverEmpIds: purchaseApproverIds })}><Check size={16} /> 구매부서 결재 요청</button>
          </div>
        )}
        {draft.canAssignPurchase && (
          <label className="equipment-assignee-picker"><span>구매 담당자</span>
            <select value={draft.purchaseAssigneeEmpId ?? ""} onChange={(event) => event.target.value && onAssign?.("purchase", Number(event.target.value))}>
              <option value="">담당자 선택</option>
              {purchaseEmployees.map((employee) => <option key={employee.empId} value={employee.empId}>{employee.empName} · {employee.positionName ?? "-"}</option>)}
            </select>
          </label>
        )}
        <div className="approval-form-grid">
          <label className="wide"><span>구매 의견</span><textarea value={draft.purchaseOpinion ?? ""} readOnly={!draft.canEditPurchaseSection} onChange={(event) => change("purchaseOpinion", event.target.value)} /></label>
          <label><span>제작업체</span><input value={draft.vendorName ?? ""} readOnly={!draft.canEditPurchaseSection} onChange={(event) => change("vendorName", event.target.value)} /></label>
          <label><span>납기(완료예정일)</span><input value={draft.deliveryDueDate ?? ""} readOnly={!draft.canEditPurchaseSection} onChange={(event) => change("deliveryDueDate", event.target.value)} /></label>
          <label><span>{moldFixture ? "제품(기종)명" : "설비/부품명"}</span><input value={draft.purchaseItemName ?? (moldFixture ? draft.productName ?? "" : "")} readOnly={!draft.canEditPurchaseSection} onChange={(event) => change("purchaseItemName", event.target.value)} /></label>
          <label><span>{moldFixture ? "제작수량" : "용도"}</span><input value={moldFixture ? draft.quantity ?? "" : draft.purchaseUsage ?? ""} readOnly={!draft.canEditPurchaseSection} onChange={(event) => moldFixture ? change("quantity", event.target.value) : change("purchaseUsage", event.target.value)} /></label>
          {!moldFixture && <label><span>수량</span><input value={draft.quantity ?? ""} readOnly={!draft.canEditPurchaseSection} onChange={(event) => change("quantity", event.target.value)} /></label>}
          {moldFixture && <label><span>CAVITY</span><input value={draft.cavity ?? ""} readOnly={!draft.canEditPurchaseSection} onChange={(event) => change("cavity", event.target.value)} /></label>}
          <label><span>가격</span><input value={draft.price ?? ""} readOnly={!draft.canEditPurchaseSection} onChange={(event) => change("price", event.target.value)} /></label>
          <label className="wide"><span>{moldFixture ? "제작사양" : "비고"}</span><textarea value={draft.purchaseNote ?? ""} readOnly={!draft.canEditPurchaseSection} onChange={(event) => change("purchaseNote", event.target.value)} /></label>
          <label className="checkbox-label"><input type="checkbox" checked={draft.attachmentContract} disabled={!draft.canEditPurchaseSection} onChange={(event) => change("attachmentContract", event.target.checked)} /> {moldFixture ? "분말금형기초자료" : "계약서"}</label>
          <label className="checkbox-label"><input type="checkbox" checked={draft.attachmentQuote} disabled={!draft.canEditPurchaseSection} onChange={(event) => change("attachmentQuote", event.target.checked)} /> {moldFixture ? "제품도면" : "견적서"}</label>
          <label className="checkbox-label"><input type="checkbox" checked={draft.attachmentDrawing} disabled={!draft.canEditPurchaseSection} onChange={(event) => change("attachmentDrawing", event.target.checked)} /> {moldFixture ? "부품도면" : "도면"}</label>
          <label className="checkbox-label"><input type="checkbox" checked={draft.attachmentSpec} disabled={!draft.canEditPurchaseSection} onChange={(event) => change("attachmentSpec", event.target.checked)} /> {moldFixture ? "견적서" : "설비사양서"}</label>
          <label className="wide"><span>기타 첨부</span><input value={draft.attachmentEtc ?? ""} readOnly={!draft.canEditPurchaseSection} onChange={(event) => change("attachmentEtc", event.target.value)} /></label>
        </div>
        {draft.canEditPurchaseSection && (
          <EmployeeMultiPicker
            title="구매 경유/협조"
            user={{ empId: approval.requesterEmpId, empName: approval.requesterName, deptName: approval.requesterDeptName, roleCode: "USER" } as User}
            employees={employees}
            selectedIds={purchaseAgreementIds}
            disabledIds={purchaseAgreementDisabledIds}
            onChange={setPurchaseAgreementIds}
          />
        )}
        {draft.canEditPurchaseSection && (
          <EmployeeMultiPicker
            title="구매부서 결재자"
            user={{ empId: approval.requesterEmpId, empName: approval.requesterName, deptName: approval.requesterDeptName, roleCode: "USER" } as User}
            employees={employees}
            selectedIds={purchaseApproverIds}
            disabledIds={purchaseAgreementIds}
            ordered
            onChange={setPurchaseApproverIds}
          />
        )}
        <AttachmentBox targetType="APPROVAL_EQUIPMENT_PURCHASE" targetId={approval.approvalId} readOnly={!draft.canEditPurchaseSection} canDownload={!!approval.permissions?.canDownloadAttachment} />
      </section>

      <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
    </article>
  );
}

function equipmentApprovalGroups(approval: Approval, proposal: EquipmentProposal) {
  const approvalLines = approval.lines
    .filter((line) => line.lineType === "APPROVAL")
    .slice()
    .sort((a, b) => a.lineOrder - b.lineOrder);
  const peInputLine = approvalLines.find((line) => line.comment === "PE_INPUT_COMPLETED")
    ?? (proposal.workflowStage === "PE_INPUT" ? approvalLines.find((line) => line.status === "PENDING" && line.assignedEmpId === proposal.peAssigneeEmpId) : undefined);
  const purchaseInputLine = approvalLines.find((line) => line.comment === "PURCHASE_INPUT_COMPLETED")
    ?? (proposal.workflowStage === "PURCHASE_INPUT" ? approvalLines.find((line) => line.status === "PENDING" && line.assignedEmpId === proposal.purchaseAssigneeEmpId) : undefined);
  const peInputOrder = peInputLine?.lineOrder ?? null;
  const purchaseInputOrder = purchaseInputLine?.lineOrder ?? null;
  const realApprovalLines = approvalLines.filter((line) => line.status !== "SKIPPED");
  return {
    userLines: realApprovalLines.filter((line) => peInputOrder == null || line.lineOrder < peInputOrder),
    peSubmitterLine: peInputLine,
    peLines: peInputOrder == null ? [] : realApprovalLines.filter((line) => line.lineOrder > peInputOrder && (purchaseInputOrder == null || line.lineOrder < purchaseInputOrder)),
    purchaseSubmitterLine: purchaseInputLine,
    purchaseLines: purchaseInputOrder == null ? [] : realApprovalLines.filter((line) => line.lineOrder > purchaseInputOrder)
  };
}

function EquipmentSectionStamp({ requester, leadLine, lines }: { requester?: Approval; leadLine?: ApprovalLine; lines: ApprovalLine[] }) {
  const leadLinePersonId = leadLine ? approvalLinePersonId(leadLine) : null;
  const leadLineIsDirectApprover = !!leadLine
    && leadLine.status === "SKIPPED"
    && lines.some((line) => approvalLinePersonId(line) === leadLinePersonId);
  const visibleLeadLine = leadLineIsDirectApprover ? null : leadLine;
  const writerColumn = requester ? {
      key: "requester",
      position: requester.requesterPositionName ?? "기안자",
      name: requester.requesterName,
      date: requester.requestedAt,
      muted: false,
      delegateText: null as string | null
    } : visibleLeadLine ? {
      key: `lead-${visibleLeadLine.lineId}`,
      position: visibleLeadLine.positionSnapshot ?? visibleLeadLine.approverPositionName ?? "작성자",
      name: visibleLeadLine.empNameSnapshot ?? visibleLeadLine.actedEmpName ?? visibleLeadLine.approverName,
      date: visibleLeadLine.signedAt ?? visibleLeadLine.actedAt,
      muted: visibleLeadLine.status !== "SKIPPED" && visibleLeadLine.status !== "APPROVED" && visibleLeadLine.status !== "REJECTED",
      delegateText: delegatedActionText(visibleLeadLine)
    } : emptyStampColumn("writer-empty");
  const approvalColumns = lines.map((line) => ({
      key: String(line.lineId),
      position: line.positionSnapshot ?? line.approverPositionName ?? "결재자",
      name: line.status === "APPROVED" || line.status === "REJECTED" ? signatureDisplayName(line) : line.approverName,
      date: line.signedAt ?? line.actedAt,
      muted: line.status !== "APPROVED" && line.status !== "REJECTED",
      delegateText: delegatedActionText(line)
    }));
  const visibleColumns = padStampColumns([writerColumn, ...approvalColumns].slice(0, 3));

  return (
    <div className="approval-stamp-wrap equipment-section-stamp">
      <div className="approval-stamp-label">결재</div>
      <div className="approval-stamp-table">
        {visibleColumns.map((column) => (
          <div className="approval-stamp-column" key={column.key}>
            <div className="stamp-position">{column.header}</div>
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

function approvalLinePersonId(line: ApprovalLine) {
  return line.assignedEmpId ?? line.approverEmpId;
}

type StampDisplayColumn = {
  key: string;
  header?: string;
  position: string;
  name: string;
  date: string | null | undefined;
  muted: boolean;
  delegateText: string | null;
};

function emptyStampColumn(key: string): StampDisplayColumn {
  return {
    key,
    header: "",
    position: "",
    name: "",
    date: null,
    muted: true,
    delegateText: null
  };
}

function padStampColumns(columns: StampDisplayColumn[], minCount = 2) {
  const padded = [...columns];
  while (padded.length < minCount) {
    padded.push(emptyStampColumn(`empty-${padded.length}`));
  }
  return withStampHeaders(padded);
}

function withStampHeaders(columns: StampDisplayColumn[]) {
  return columns.map((column, index) => ({
    ...column,
    header: index === 0 ? "작성" : index === columns.length - 1 ? "승인" : "검토"
  }));
}

function equipmentStageLabel(stage: EquipmentProposal["workflowStage"]) {
  const labels: Record<EquipmentProposal["workflowStage"], string> = {
    USER_APPROVAL: "사용부서 결재",
    PE_INPUT: "주관부서 작성",
    PE_APPROVAL: "주관부서 결재",
    PURCHASE_INPUT: "구매부서 작성",
    PURCHASE_APPROVAL: "구매부서 결재",
    COMPLETED: "완료"
  };
  return labels[stage] ?? stage;
}
