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
import { EquipmentProposalUserSection, LeaveRequestDetailView, MoldFixtureProposalUserSection } from "./ApprovalFormParts";
export function ClassicDraftEditor({
  user,
  employees,
  form,
  onChange
}: {
  user: User;
  employees: Employee[];
  form: ApprovalForm;
  onChange: (form: ApprovalForm) => void;
}) {
  const approvers = employeesByIds(employees, form.approverEmpIds);
  const agreementText = formatEmployeeList(employees, form.agreementEmpIds);
  const draftDept = user.deptName ?? "소속 미지정";
  const expectedNo = `${documentPrefix(form.templateCode)}-${new Date().getFullYear()}-자동생성`;

  return (
    <div className="classic-draft-editor">
      <div className="classic-draft-paper">
        <div className="classic-draft-logo-wrap">
          <img src={schunkLogo} alt="SCHUNK" />
        </div>
        <h2>기 안 서</h2>
        <div className="classic-draft-head">
          <table className="classic-draft-info">
            <tbody>
              <tr><th>문서번호</th><td>{expectedNo}</td></tr>
              <tr><th>기안부서(자)</th><td>{draftDept} / {user.empName}</td></tr>
              <tr><th>기안일자</th><td>{todayDate()}</td></tr>
              <tr><th>경유 / 협조</th><td>{agreementText}</td></tr>
              <tr>
                <th>제목</th>
                <td><input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="기안 제목" /></td>
              </tr>
            </tbody>
          </table>
          <div className="classic-approval-box">
            <div className="classic-approval-title">위 임 전 결 규 정<br /><span>(대표이사) 전결</span></div>
            <div className={`classic-approval-grid ${approvers.length >= 4 ? "many" : ""}`} style={{ gridTemplateColumns: `repeat(${Math.max(2, approvers.length + 1)}, minmax(0, 1fr))` }}>
              <div className="classic-approval-cell header">기안</div>
              {approvers.map((employee, index) => <div className="classic-approval-cell header" key={employee.empId}>{index + 1}</div>)}
              <div className="classic-approval-cell signer">기안자<strong>{user.empName}</strong></div>
              {approvers.map((employee) => (
                <div className="classic-approval-cell signer" key={employee.empId}>
                  {employee.positionName ?? employee.jobTitle ?? "결재자"}
                  <strong>{employee.empName}</strong>
                </div>
              ))}
              <div className="classic-approval-cell date">{todayDate()}</div>
              {approvers.map((employee) => <div className="classic-approval-cell date" key={employee.empId}>상신 후 처리</div>)}
            </div>
            <div className="classic-opinion-preview">
              <strong>지시사항(의견)</strong>
              <span>승인/반려 의견은 결재 후 자동 표시됩니다.</span>
            </div>
          </div>
        </div>
        <label className="classic-draft-body">본문
          <textarea value={form.content} onChange={(event) => onChange({ ...form, content: event.target.value })} placeholder="기안 내용을 입력하세요." />
        </label>
      </div>
      <p className="muted-text">경유/협조는 합의 라인에서 자동 생성됩니다. 결재선 선택을 변경하면 이 미리보기도 함께 갱신됩니다.</p>
    </div>
  );
}
export function ClassicDraftDetailView({ approval, templates }: { approval: Approval; templates: ApprovalTemplateOption[] }) {
  const approvers = approval.lines.filter((line) => line.lineType === "APPROVAL").sort((a, b) => a.lineOrder - b.lineOrder);
  const opinions = approvalOpinionLines(approval.lines);
  const approvalColumns = Math.max(2, approvers.length + 1);

  return (
    <article className="classic-draft-detail">
      <div className="classic-draft-paper">
        <div className="classic-draft-logo-wrap">
          <img src={schunkLogo} alt="SCHUNK" />
        </div>
        <h2>기 안 서</h2>
        <div className="classic-draft-head">
          <table className="classic-draft-info">
            <tbody>
              <tr><th>문서번호</th><td>{approval.documentNo ?? "상신 시 자동생성"}</td></tr>
              <tr><th>기안부서(자)</th><td>{approval.draftDeptName ?? approval.requesterDeptName ?? "-"} / {approval.requesterName}</td></tr>
              <tr><th>기안일자</th><td>{formatDate(approval.requestedAt)}</td></tr>
              <tr><th>경유 / 협조</th><td>{formatApprovalLines(approval.lines, "AGREEMENT")}</td></tr>
              <tr><th>제목</th><td>{approval.title}</td></tr>
            </tbody>
          </table>
          <div className="classic-approval-box">
            <div className="classic-approval-title">위 임 전 결 규 정<br /><span>(대표이사) 전결</span></div>
            <div className={`classic-approval-grid ${approvers.length >= 4 ? "many" : ""}`} style={{ gridTemplateColumns: `repeat(${approvalColumns}, minmax(0, 1fr))` }}>
              <div className="classic-approval-cell header">기안</div>
              {approvers.map((line, index) => <div className="classic-approval-cell header" key={line.lineId}>{index + 1}</div>)}
              <div className="classic-approval-cell signer">{approval.requesterPositionName ?? "기안자"}<strong>{approval.requesterName}</strong></div>
              {approvers.map((line) => (
                <div className="classic-approval-cell signer" key={line.lineId}>
                  {line.positionSnapshot ?? line.approverPositionName ?? "결재자"}
                  <strong>{lineStatusLabel(line.status)}</strong>
                  <span>{line.empNameSnapshot ?? line.approverName}</span>
                  {isDelegatedAction(line) && (
                    <span className="stamp-delegate">대리결재 · {lineActedName(line)}</span>
                  )}
                </div>
              ))}
              <div className="classic-approval-cell date">{formatDate(approval.requestedAt)}</div>
              {approvers.map((line) => <div className="classic-approval-cell date" key={line.lineId}>{line.signedAt ? formatDate(line.signedAt) : "-"}</div>)}
            </div>
            <div className="classic-opinion-preview">
              <strong>지시사항(의견)</strong>
              {opinions.length ? opinions.map((line) => (
                <p key={line.lineId}>{line.empNameSnapshot ?? line.approverName}: {line.comment}</p>
              )) : <span>등록된 결재 의견이 없습니다.</span>}
            </div>
          </div>
        </div>
        <section className="classic-draft-body-read">
          <h3>본문</h3>
          <div className="detail-content">{approvalContent(approval) ? <RichContent content={approvalContent(approval)} /> : "내용이 없습니다."}</div>
        </section>
        <div className="classic-draft-footer-grid">
          <div><strong>수신</strong><span>{formatApprovalLines(approval.lines, "RECEIVER")}</span></div>
          <div><strong>참조</strong><span>{formatApprovalLines(approval.lines, "REFERENCE")}</span></div>
          <div><strong>연람</strong><span>{formatApprovalLines(approval.lines, "READER")}</span></div>
          <div><strong>상태</strong><span>{statusLabel(approval.status)} · {stageLabel(approval.currentStage)}</span></div>
          <div><strong>양식</strong><span>{templateName(templates, approval.templateCode)} v{approval.templateVersion ?? "-"}</span></div>
          <div><strong>완료일</strong><span>{approval.completedAt ? formatDate(approval.completedAt) : "-"}</span></div>
        </div>
      </div>
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

function ApprovalStampTable({ approval }: { approval: Approval }) {
  const columns = padClassicStampColumns([
    {
      key: "requester",
      position: approval.requesterPositionName ?? "작성자",
      name: approval.requesterName,
      date: approval.requestedAt,
      muted: false,
      delegateText: null
    },
    ...approval.lines
      .slice()
      .sort((a, b) => a.lineOrder - b.lineOrder)
      .map((line) => ({
        key: String(line.lineId),
        position: line.approverPositionName ?? "-",
        name: line.status === "APPROVED" || line.status === "REJECTED" ? signatureDisplayName(line) : line.approverName,
        date: line.signedAt ?? line.actedAt,
        muted: line.status !== "APPROVED" && line.status !== "REJECTED",
        delegateText: delegatedActionText(line)
      }))
  ]);

  return (
    <div className="approval-stamp-wrap">
      <div className="approval-stamp-label">결재</div>
      <div className="approval-stamp-table">
        {columns.map((column) => (
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

function padClassicStampColumns(columns: Array<{ key: string; position: string; name: string; date?: string | null; muted: boolean; delegateText?: string | null }>, minCount = 2) {
  const padded = [...columns];
  while (padded.length < minCount) {
    padded.push({ key: `empty-${padded.length}`, position: "", name: "", date: "", muted: true });
  }
  return padded;
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