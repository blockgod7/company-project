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
import { FormEvent, lazy, Suspense, useEffect, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { api, authenticatedFetch, jsonBody } from "../api";
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
  ENABLE_TEMPLATE_FALLBACK,
  equipmentProposalCapacityLabel,
  equipmentProposalGeneratedTitle,
  equipmentProposalItemFallback,
  equipmentProposalItemLabel,
  equipmentProposalTitle,
  firstReceiverLineOrder,
  firstSelectableApprovalTemplate,
  formatDayValue,
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
  EquipmentProposal,
  LeaveUsage,
  PageResponse,
  User
} from "../types";
import { EquipmentProposalUserSection, LeaveRequestDetailView, MoldFixtureProposalUserSection } from "./ApprovalFormParts";
import { ApprovalDocumentHeader, ApprovalDocumentMeta, ApprovalDocumentPdfNotice, ApprovalDocumentSectionHeader } from "./ApprovalDocumentWebParts";
import { richTextEditorHtml } from "../utils/richText";
const RichTextEditor = lazy(() => import("../components/RichTextEditor").then((module) => ({ default: module.RichTextEditor })));
export function ClassicDraftEditor({
  user,
  form,
  headerActions,
  onChange,
  readOnly = false
}: {
  user: User;
  form: ApprovalForm;
  headerActions?: ReactNode;
  onChange: (form: ApprovalForm) => void;
  readOnly?: boolean;
}) {
  const draftDept = user.deptName ?? "소속 미지정";
  const expectedNo = `${documentPrefix(form.templateCode)}-${new Date().getFullYear()}-자동생성`;

  return (
    <div className="classic-draft-editor approval-document-web">
      <ApprovalDocumentHeader eyebrow="전자결재 · 기안 공문" title="기안서 작성" description="일반 업무 기안 내용을 작성하고 결재를 요청합니다." actions={headerActions} />
      <ApprovalDocumentMeta items={[
        { label: "작성자", value: user.empName },
        { label: "소속부서", value: draftDept },
        { label: "작성일", value: todayDate() },
        { label: "문서번호", value: expectedNo }
      ]} />
      <section className="approval-document-section classic-draft-content-card">
        <ApprovalDocumentSectionHeader title="기안 내용" description="제목과 본문을 작성합니다. 결재선은 상단의 결재 정보에서 별도로 관리합니다." badge="작성자 입력" />
        <div className="approval-document-section-body classic-draft-form-grid">
          <label>
            <span>문서 제목 <em>필수</em></span>
            <input required readOnly={readOnly} value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="기안 제목을 입력하세요." />
          </label>
          <div className="classic-draft-rich-field">
            <span>기안 내용 <em>필수</em></span>
            {readOnly ? <div className="rich-text-editor read-only"><RichContent content={richTextEditorHtml(form.content) || "<p><br></p>"} /></div> : <Suspense fallback={<div className="rich-text-editor loading" role="status">편집기를 불러오는 중입니다.</div>}>
              <RichTextEditor content={form.content} onChange={(content) => onChange({ ...form, content })} readOnly={readOnly} />
            </Suspense>}
          </div>
        </div>
      </section>
      <ApprovalDocumentPdfNotice />
    </div>
  );
}
export function ClassicDraftDetailView({ approval, templates }: { approval: Approval; templates: ApprovalTemplateOption[] }) {
  return (
    <article className="classic-draft-detail approval-document-web">
      <ApprovalDocumentHeader eyebrow="전자결재 · 기안 공문" title="기안서" description={approval.title} />
      <ApprovalDocumentMeta items={[
        { label: "문서번호", value: approval.documentNo ?? "상신 시 자동생성" },
        { label: "기안자", value: approval.requesterName },
        { label: "기안부서", value: approval.draftDeptName ?? approval.requesterDeptName ?? "-" },
        { label: "기안일", value: formatDate(approval.requestedAt) }
      ]} />
      <section className="approval-document-section classic-draft-content-card">
        <ApprovalDocumentSectionHeader title="기안 내용" description={`${templateName(templates, approval.templateCode)} v${approval.templateVersion ?? "-"} · ${statusLabel(approval.status)} · ${stageLabel(approval.currentStage)}`} />
        <div className="approval-document-section-body classic-draft-read-grid">
          <div>
            <span>문서 제목</span>
            <strong>{approval.title}</strong>
          </div>
          <div>
            <span>기안 내용</span>
            <div className="detail-content">{approvalContent(approval) ? <RichContent content={approvalContent(approval)} /> : "내용이 없습니다."}</div>
          </div>
        </div>
      </section>
      <ApprovalDocumentPdfNotice available={approval.pdfStatus === "GENERATED" && approval.pdfFileId != null} />
    </article>
  );
}

export async function downloadApprovalPdf(approvalId: number, fileName: string) {
  const response = await authenticatedFetch(`/approvals/${approvalId}/pdf`);
  if (!response.ok) return;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ApprovalOpinionList({ lines }: { lines: Approval["lines"] }) {
  const orderedLines = lines.slice().sort((a, b) => a.lineOrder - b.lineOrder);
  return (
    <div className="approval-opinions">
      <h3>결재 의견</h3>
      {orderedLines.map((line) => {
        const acted = line.status === "APPROVED" || line.status === "REJECTED";
        return (
          <div className={`approval-opinion ${acted ? "acted" : ""}`} key={line.lineId}>
            <div>
              <strong className="approval-opinion-person">
                {line.lineOrder}. {line.approverName}
                <span className={`line-type-badge line-type-${line.lineType.toLowerCase()}`}>{lineTypeLabel(line.lineType)}</span>
              </strong>
              <span>{line.approverDeptName ?? "-"} · {line.approverPositionName ?? "-"} · {lineStatusLabel(line.status)}</span>
              {lineDueText(line) && <span className="due-text">{lineDueText(line)}</span>}
              {delegatedActionText(line) && <span className="delegated-action-text"><b>대리 처리</b> {delegatedActionText(line)}</span>}
            </div>
            <p>{line.comment?.trim() || (acted ? "의견 없음" : "처리 전")}</p>
            {line.actedAt && <time>{formatDate(line.actedAt)}</time>}
          </div>
        );
      })}
    </div>
  );
}

export function signatureDisplayName(line: ApprovalLine) {
  try {
    const parsed = line.signatureSnapshotJson ? JSON.parse(line.signatureSnapshotJson) : null;
    return typeof parsed?.displayName === "string" && parsed.displayName.trim() ? parsed.displayName : line.approverName;
  } catch {
    return line.approverName;
  }
}

function ApprovalLineView({ lines }: { lines: Approval["lines"] }) {
  return (
    <div className="approval-lines">
      <h3>결재선</h3>
      {lines.map((line) => (
        <div className="approval-line" key={line.lineId}>
          <strong>{line.lineOrder}. {line.approverName}</strong>
          <span>{line.approverDeptName ?? "-"} · {line.approverPositionName ?? "-"} · {lineStatusLabel(line.status)}</span>
          {lineDueText(line) && <span className="due-text">{lineDueText(line)}</span>}
          {delegatedActionText(line) && <span className="delegated-action-text"><b>대리 처리</b> {delegatedActionText(line)}</span>}
          {line.comment && <p>{line.comment}</p>}
        </div>
      ))}
    </div>
  );
}
