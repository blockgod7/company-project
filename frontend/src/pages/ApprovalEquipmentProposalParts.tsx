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
import { PurchaseDraftStampHeader, TrainingDraftStampHeader } from "./ApprovalParts";
import { ApprovalDocumentHeader, ApprovalDocumentMeta, ApprovalDocumentPdfNotice, ApprovalDocumentSectionHeader } from "./ApprovalDocumentWebParts";
import { isProductionEngineeringRequester } from "../utils/approvalPeople";
export function EquipmentProposalEditor({ user, employees, form, headerActions, onChange }: { user: User; employees: Employee[]; form: ApprovalForm; headerActions?: ReactNode; onChange: (form: ApprovalForm) => void }) {
  const requesterDeptName = currentUserDeptName(user, employees, form.fieldValues.requestDeptName ?? "");
  const proposalTitle = equipmentProposalTitle(form.templateCode);
  const selfRequest = isProductionEngineeringRequester(user, employees);
  const expectedNo = `${documentPrefix(form.templateCode)}-${new Date().getFullYear()}-자동생성`;
  const generatedTitle = equipmentProposalGeneratedTitle(form.fieldValues, form.templateCode);
  const isAutoTitle = !form.title.trim() || form.title.trim() === proposalTitle || form.title.trim() === generatedTitle;
  function value(name: string) {
    if (name === "requestDeptName") return requesterDeptName;
    return form.fieldValues[name] ?? "";
  }
  function setValue(name: string, next: string) {
    const fieldValues = { ...form.fieldValues, requestDeptName: requesterDeptName, [name]: next };
    if (name === "moldPartsJson") {
      const firstPart = parseMoldFixtureParts(fieldValues)[0] ?? blankMoldFixturePart();
      fieldValues.partName = firstPart.partName;
      fieldValues.cavity = firstPart.cavity;
      fieldValues.material = firstPart.material;
      fieldValues.quantity = firstPart.quantity;
      fieldValues.moldNo = firstPart.moldNo;
    }
    const oldGeneratedTitle = equipmentProposalGeneratedTitle(form.fieldValues, form.templateCode);
    const shouldAutoTitle = !form.title.trim() || form.title === proposalTitle || form.title === oldGeneratedTitle;
    const title = (name === "equipmentName" || name === "moldNo" || name === "moldPartsJson" || name === "requestType") && shouldAutoTitle
      ? equipmentProposalGeneratedTitle(fieldValues, form.templateCode)
      : form.title;
    onChange({ ...form, title, content: equipmentProposalContent(fieldValues, form.templateCode), fieldValues });
  }

  return (
    <article className="approval-template-editor equipment-proposal-editor equipment-proposal-detail approval-document-web">
      <ApprovalDocumentHeader
        eyebrow="전자결재 · 기안 공문"
        title={`${proposalTitle} 작성`}
        description={selfRequest ? "생산기술 자체 요청 · 요청·주관 내용을 함께 작성하고 통합 결재가 끝나면 구매부서로 전달합니다." : "사용부서 요청을 시작으로 주관부서와 구매부서가 단계별로 작성합니다."}
        actions={headerActions}
      />
      <ApprovalDocumentMeta items={[
        { label: "작성자", value: user.empName },
        { label: "요청부서", value: requesterDeptName },
        { label: "작성일", value: todayDate() },
        { label: "문서번호", value: expectedNo }
      ]} />
      <section className="approval-detail-section approval-document-section equipment-title-section">
        <ApprovalDocumentSectionHeader title="문서 기본정보" description="품목과 구분을 입력하면 문서 제목이 자동으로 제안됩니다." badge="작성자 입력" />
        <div className="approval-document-section-body approval-form-grid">
          <label className="wide">{requiredLabel("문서 제목")}<input className={isAutoTitle ? "auto-title-input" : ""} required value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder={isMoldFixtureTemplateCode(form.templateCode) ? "예: S-BB123 제작 품의서" : "예: 가공기-1 개선 품의서"} /></label>
        </div>
      </section>
      {isMoldFixtureTemplateCode(form.templateCode) ? (
        <MoldFixtureProposalUserSection value={value} onChange={setValue} />
      ) : (
        <EquipmentProposalUserSection templateCode={form.templateCode} value={value} onChange={setValue} />
      )}
      {selfRequest && (
        <section className="approval-detail-section approval-document-section equipment-self-request">
          <ApprovalDocumentSectionHeader title="주관부서 작성란" description="생산기술 자체 요청으로 요청 내용과 함께 결재됩니다. 별도의 주관부서 재상신은 없습니다." badge="통합 작성" />
          <EquipmentProposalPeFields value={value} onChange={setValue} />
        </section>
      )}
      <ApprovalDocumentPdfNotice />
    </article>
  );
}
export function EquipmentProposalPeFields({ value, onChange, readOnly = false }: { value: (name: string) => string; onChange?: (name: string, value: string) => void; readOnly?: boolean }) {
  return <div className="approval-form-grid">
    <label className="wide"><span>주관부서(PE) 의견</span><textarea value={value("peOpinion")} readOnly={readOnly} onChange={(event) => onChange?.("peOpinion", event.target.value)} /></label>
    <label className="wide"><span>설계 의견</span><textarea value={value("designOpinion")} readOnly={readOnly} onChange={(event) => onChange?.("designOpinion", event.target.value)} /></label>
    <label className="wide"><span>경제성 검토 - 주관 부서</span><textarea value={value("peEconomicReview")} readOnly={readOnly} onChange={(event) => onChange?.("peEconomicReview", event.target.value)} /></label>
  </div>;
}

export function EquipmentProposalUserSection({
  templateCode,
  value,
  onChange,
  readOnly = false,
  stamp,
  children
}: {
  templateCode?: string | null;
  value: (name: string) => string;
  onChange?: (name: string, next: string) => void;
  readOnly?: boolean;
  stamp?: ReactNode;
  children?: ReactNode;
}) {
  const change = (name: string) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    onChange?.(name, event.target.value);
  };
  const moldFixture = isMoldFixtureTemplateCode(templateCode);

  return (
    <section className={`approval-detail-section approval-document-section${moldFixture ? "" : " equipment-request-section"}`}>
      <ApprovalDocumentSectionHeader title="사용부서 작성란" description="요청 대상과 완료요구일, 현상 및 요구사항을 입력합니다." badge={readOnly ? "조회" : "현재 단계"} />
      <div className={`approval-document-section-body approval-form-grid${moldFixture ? "" : " equipment-request-fields"}`}>
        {moldFixture && (
          <>
            <label>{requiredLabel("품목")}
              <select required disabled={readOnly} value={value("moldFixtureType")} onChange={change("moldFixtureType")}>
                <option value="">선택</option>
                <option value="금형">금형</option>
                <option value="치공구">치공구</option>
              </select>
            </label>
            <label><span>고객사</span><input readOnly={readOnly} value={value("customerName")} onChange={change("customerName")} /></label>
            <label>{requiredLabel("제품(기종)명")}<input required readOnly={readOnly} value={value("productName")} onChange={change("productName")} /></label>
            <label><span>용도</span><input readOnly={readOnly} value={value("usageText")} onChange={change("usageText")} /></label>
          </>
        )}
        <label>{requiredLabel(moldFixture ? "사용부서" : "요청부서")}<input required readOnly value={value("requestDeptName")} title="작성자 소속부서로 자동 지정됩니다." /></label>
        <label>{requiredLabel("완료요구일")}<input required type="date" readOnly={readOnly} value={value("requiredCompletionDate")} onChange={change("requiredCompletionDate")} /></label>
        <label>{requiredLabel("구분")}
          <select required disabled={readOnly} value={value("requestType")} onChange={change("requestType")}>
            <option value="">선택</option>
            {(moldFixture ? ["고객지급", "투자", "설계 및 제작", "구매", "수리", "매각", "폐기"] : ["구입", "제작", "개선", "수리", "매각", "폐기"]).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        {!moldFixture && (
          <>
            <label>{requiredLabel(equipmentProposalItemLabel(templateCode))}<input required readOnly={readOnly} value={value("equipmentName")} onChange={change("equipmentName")} /></label>
            <label><span>{equipmentProposalCapacityLabel(templateCode)}</span><input readOnly={readOnly} value={value("equipmentCapacity")} onChange={change("equipmentCapacity")} /></label>
          </>
        )}
        <label className="wide">{requiredLabel(moldFixture ? "사유" : "현상")}<textarea required readOnly={readOnly} value={value("currentState")} onChange={change("currentState")} /></label>
        {moldFixture && (
          <>
            <label><span>부품명</span><input readOnly={readOnly} value={value("partName")} onChange={change("partName")} /></label>
            <label><span>CAVITY</span><input readOnly={readOnly} value={value("cavity")} onChange={change("cavity")} /></label>
            <label><span>재질</span><input readOnly={readOnly} value={value("material")} onChange={change("material")} /></label>
            <label><span>수량</span><input readOnly={readOnly} value={value("quantity")} onChange={change("quantity")} /></label>
            <label><span>금형번호</span><input readOnly={readOnly} value={value("moldNo")} onChange={change("moldNo")} /></label>
          </>
        )}
        <label className="wide">{requiredLabel("요구사항")}<textarea required={!moldFixture} readOnly={readOnly} value={value("requirements")} onChange={change("requirements")} /></label>
        <label className="wide"><span>지시 사항</span><textarea readOnly={readOnly} value={value("instructions")} onChange={change("instructions")} /></label>
        <label className="wide"><span>경제성 검토 - 사용부서</span><textarea readOnly={readOnly} value={value("userEconomicReview")} onChange={change("userEconomicReview")} /></label>
      </div>
      {children}
    </section>
  );
}

export function MoldFixtureProposalUserSection({
  value,
  onChange,
  readOnly = false,
  stamp,
  children
}: {
  value: (name: string) => string;
  onChange?: (name: string, next: string) => void;
  readOnly?: boolean;
  stamp?: ReactNode;
  children?: ReactNode;
}) {
  const change = (name: string) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    onChange?.(name, event.target.value);
  };

  return (
    <section className="approval-detail-section approval-document-section mold-fixture-section">
      <ApprovalDocumentSectionHeader title="사용부서 작성란" description="품목 정보와 부품 목록, 제작 사유 및 요구사항을 입력합니다." badge={readOnly ? "조회" : "현재 단계"} />
      <div className="approval-document-section-body mold-fixture-form">
        <label className="mold-item-type">{requiredLabel("품목")}
          <select required disabled={readOnly} value={value("moldFixtureType")} onChange={change("moldFixtureType")}>
            <option value="">선택</option>
            <option value="금형">금형</option>
            <option value="치공구">치공구</option>
          </select>
        </label>
        <label><span>고객사</span><input readOnly={readOnly} value={value("customerName")} onChange={change("customerName")} /></label>
        <label>{requiredLabel("제품(기종)명")}<input required readOnly={readOnly} value={value("productName")} onChange={change("productName")} /></label>
        <label>{requiredLabel("사용부서")}<input required readOnly value={value("requestDeptName")} title="작성자 소속부서로 자동 지정됩니다." /></label>
        <label><span>용도</span><input readOnly={readOnly} value={value("usageText")} onChange={change("usageText")} /></label>
        <label>{requiredLabel("완료요구일")}<input required type="date" readOnly={readOnly} value={value("requiredCompletionDate")} onChange={change("requiredCompletionDate")} /></label>
        <label className="mold-request-type">{requiredLabel("구분")}
          <select required disabled={readOnly} value={value("requestType")} onChange={change("requestType")}>
            <option value="">선택</option>
            {["고객지급", "투자", "설계 및 제작", "구매", "수리", "매각", "폐기"].map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="mold-wide mold-reason">{requiredLabel("사유")}<textarea required readOnly={readOnly} value={value("currentState")} onChange={change("currentState")} /></label>

        <MoldFixturePartTable
          parts={parseMoldFixtureParts({
            moldPartsJson: value("moldPartsJson"),
            partName: value("partName"),
            cavity: value("cavity"),
            material: value("material"),
            quantity: value("quantity"),
            moldNo: value("moldNo")
          })}
          readOnly={readOnly}
          onChange={(parts) => onChange?.("moldPartsJson", moldFixturePartsJson(parts))}
        />

        <label className="mold-half"><span>요구사항</span><textarea readOnly={readOnly} value={value("requirements")} onChange={change("requirements")} /></label>
        <label className="mold-half"><span>지시사항</span><textarea readOnly={readOnly} value={value("instructions")} onChange={change("instructions")} /></label>
        <label className="mold-wide mold-economic"><span>경제성 검토 - 사용부서</span><textarea readOnly={readOnly} value={value("userEconomicReview")} onChange={change("userEconomicReview")} /></label>
      </div>
      {children}
    </section>
  );
}

function MoldFixturePartTable({
  parts,
  readOnly,
  onChange
}: {
  parts: MoldFixturePart[];
  readOnly: boolean;
  onChange: (parts: MoldFixturePart[]) => void;
}) {
  const rows = normalizeMoldFixtureParts(parts);
  const update = (index: number, field: keyof MoldFixturePart, value: string) => {
    const next = rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row);
    onChange(next);
  };
  const add = () => onChange([...rows, blankMoldFixturePart()]);
  const remove = (index: number) => onChange(rows.length === 1 ? [blankMoldFixturePart()] : rows.filter((_, rowIndex) => rowIndex !== index));

  return (
    <div className={`mold-part-table mold-wide${readOnly ? " readonly" : ""}`}>
      <div className="mold-part-title">부품 정보</div>
      <div className={`mold-part-grid${readOnly ? " readonly" : ""}`}>
        <div className="mold-part-header">부품명</div>
        <div className="mold-part-header">CAVITY</div>
        <div className="mold-part-header">재질</div>
        <div className="mold-part-header">수량</div>
        <div className="mold-part-header">금형번호</div>
        {!readOnly && <div className="mold-part-header">관리</div>}
        {rows.map((part, index) => (
          <div className="mold-part-row" key={index}>
            <input readOnly={readOnly} value={part.partName} onChange={(event) => update(index, "partName", event.target.value)} />
            <input readOnly={readOnly} value={part.cavity} onChange={(event) => update(index, "cavity", event.target.value)} />
            <input readOnly={readOnly} value={part.material} onChange={(event) => update(index, "material", event.target.value)} />
            <input readOnly={readOnly} value={part.quantity} onChange={(event) => update(index, "quantity", event.target.value)} />
            <input readOnly={readOnly} value={part.moldNo} onChange={(event) => update(index, "moldNo", event.target.value)} />
            {!readOnly && (
              <button type="button" className="ghost mold-part-remove" onClick={() => remove(index)}>
                <Trash2 size={14} /> 삭제
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button type="button" className="ghost mold-part-add" onClick={add}>
            <Plus size={14} /> 부품 추가
          </button>
        )}
      </div>
    </div>
  );
}

function requiredLabel(label: string) {
  return <span className="required-label">{label}<em>필수</em></span>;
}

export function equipmentProposalContent(values: Record<string, string>, templateCode?: string | null) {
  if (isMoldFixtureTemplateCode(templateCode)) {
    return [
      `품목: ${values.moldFixtureType ?? ""}`,
      `고객사: ${values.customerName ?? ""}`,
      `제품(기종)명: ${values.productName ?? ""}`,
      `사용부서: ${values.requestDeptName ?? ""}`,
      `용도: ${values.usageText ?? ""}`,
      `완료요구일: ${values.requiredCompletionDate ?? ""}`,
      `구분: ${values.requestType ?? ""}`,
      "",
      "[사유]",
      values.currentState ?? "",
      "",
      "[부품 정보]",
      `부품명: ${values.partName ?? ""}`,
      `CAVITY: ${values.cavity ?? ""}`,
      `재질: ${values.material ?? ""}`,
      `수량: ${values.quantity ?? ""}`,
      `금형번호: ${values.moldNo ?? ""}`,
      "",
      "[요구사항]",
      values.requirements ?? "",
      "",
      "[지시 사항]",
      values.instructions ?? "",
      "",
      "[경제성 검토 - 사용부서]",
      values.userEconomicReview ?? ""
    ].join("\n");
  }
  return [
    `요청부서: ${values.requestDeptName ?? ""}`,
    `${equipmentProposalItemLabel(templateCode)}: ${values.equipmentName ?? ""}`,
    `완료요구일: ${values.requiredCompletionDate ?? ""}`,
    `구분: ${values.requestType ?? ""}`,
    "",
    "[현상]",
    values.currentState ?? "",
    "",
    "[요구사항]",
    values.requirements ?? "",
    "",
    "[지시 사항]",
    values.instructions ?? "",
    "",
    "[경제성 검토 - 사용부서]",
    values.userEconomicReview ?? ""
  ].join("\n");
}
