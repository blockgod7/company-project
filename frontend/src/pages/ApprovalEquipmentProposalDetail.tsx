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
