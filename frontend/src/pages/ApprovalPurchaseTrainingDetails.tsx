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

export function ApprovalHistorySection({ lines }: { lines: ApprovalLine[] }) {
  const decisionLines = lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL").slice().sort((a, b) => a.lineOrder - b.lineOrder);
  const receiverLines = lines.filter((line) => line.lineType === "RECEIVER");
  const referenceLines = lines.filter((line) => line.lineType === "REFERENCE" || line.lineType === "READER");
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
        {referenceLines.length > 0 && <div className="approval-history-row shared"><strong>참조</strong><span>{referenceLines.map((line) => line.empNameSnapshot ?? line.approverName).join(", ")}</span><span>최종 결재 완료 후 공유</span></div>}
      </div>
    </section>
  );
}
