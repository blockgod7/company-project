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
import { EquipmentProposalPeFields, EquipmentProposalUserSection, MoldFixtureProposalUserSection } from "./ApprovalEquipmentProposalParts";
import { LeaveRequestDetailView } from "./ApprovalLeaveParts";
import { ApprovalOpinionList, ClassicDraftDetailView, signatureDisplayName } from "./ApprovalClassicParts";
import { emptyStampColumn, padStampColumns } from "./ApprovalStampUtils";
import type { StampDisplayColumn } from "./ApprovalStampUtils";
import { ApprovalDocumentHeader, ApprovalDocumentMeta, ApprovalDocumentPdfNotice, ApprovalDocumentSectionHeader } from "./ApprovalDocumentWebParts";
export function EquipmentProposalDetailView({
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
  const proposalTitle = equipmentProposalTitle(approval.templateCode);
  const moldFixture = isMoldFixtureTemplateCode(approval.templateCode);

  function change<K extends keyof EquipmentProposal>(key: K, value: EquipmentProposal[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <article className="approval-detail equipment-proposal-detail approval-document-web">
      <ApprovalDocumentHeader eyebrow="전자결재 · 기안 공문" title={proposalTitle} description={approval.title} />
      <ApprovalDocumentMeta items={[
        { label: "문서번호", value: approval.documentNo ?? "상신 시 자동 생성" },
        { label: "기안자", value: approval.requesterName },
        { label: "기안부서", value: approval.draftDeptName ?? approval.requesterDeptName ?? "-" },
        { label: "진행단계", value: draft.peSelfRequest && draft.workflowStage === "USER_APPROVAL" ? "요청·주관 통합 결재" : equipmentStageLabel(draft.workflowStage) }
      ]} />
      {draft.peSelfRequest && <p className="muted-text">생산기술 자체 요청 · 요청·주관 통합 결재 후 구매부서로 전달됩니다.</p>}

      {moldFixture ? (
        <MoldFixtureProposalUserSection
          readOnly
          value={(name) => String(draft[name as keyof EquipmentProposal] ?? "")}
        >
          <AttachmentBox targetType="APPROVAL_EQUIPMENT_USER" targetId={approval.approvalId} readOnly={!draft.canEditUserSection} canDownload={!!approval.permissions?.canDownloadAttachment} />
        </MoldFixtureProposalUserSection>
      ) : (
        <EquipmentProposalUserSection
          templateCode={approval.templateCode}
          readOnly
          value={(name) => String(draft[name as keyof EquipmentProposal] ?? "")}
        >
          <AttachmentBox targetType="APPROVAL_EQUIPMENT_USER" targetId={approval.approvalId} readOnly={!draft.canEditUserSection} canDownload={!!approval.permissions?.canDownloadAttachment} />
        </EquipmentProposalUserSection>
      )}

      <section className="approval-detail-section approval-document-section">
        <ApprovalDocumentSectionHeader title="주관부서 작성란" description="기술·설계 의견과 주관부서 경제성 검토를 작성합니다." badge={draft.canEditPeSection ? "현재 단계" : "조회"} />
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
        <EquipmentProposalPeFields value={(name) => String(draft[name as keyof EquipmentProposal] ?? "")} readOnly={!draft.canEditPeSection} onChange={(name, value) => change(name as keyof EquipmentProposal, value)} />
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

      <section className="approval-detail-section approval-document-section">
        <ApprovalDocumentSectionHeader title="구매부서 작성란" description="업체·납기·가격·첨부자료와 구매 의견을 작성합니다." badge={draft.canEditPurchaseSection ? "현재 단계" : "조회"} />
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

      <ApprovalDocumentPdfNotice available={approval.pdfStatus === "GENERATED" && approval.pdfFileId != null} />
    </article>
  );
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
