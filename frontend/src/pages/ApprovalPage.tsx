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
import { ListState } from "../components/ListState";
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
  isWorkRequestTemplateCode,
  isEmergencyCallRequestTemplateCode,
  isWorkRequestChangeTemplateCode,
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
  leaveReceiverId,
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
  selectableLeaveTypeOptions,
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
import { canViewPlannedFeatures } from "../navigation";
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
  EquipmentReport,
  LeaveExclusion,
  LeaveUsage,
  PageResponse,
  User
} from "../types";
import { ClassicDraftEditor, downloadApprovalPdf } from "./ApprovalClassicParts";
import { ApprovalHolidayPanel } from "./ApprovalHolidayPanel";
import { AnnualLeaveAdminPanel } from "./AnnualLeaveAdminPanel";
import { LeavePolicyAdminPanel } from "./LeavePolicyAdminPanel";
import { CompTimeAdminPanel } from "./CompTimeAdminPanel";
import { LeaveAdminCasePanel } from "./LeaveAdminCasePanel";
import { ApprovalDetailView } from "./ApprovalParts";
import { EquipmentProposalEditor, equipmentProposalContent, LeaveRequestEditor, PurchaseRequestEditor, TemplateFieldInputs, TrainingReportEditor, TrainingRequestEditor, WorkRequestEditor } from "./ApprovalFormParts";
import { APPROVAL_BOXES, isApprovalBox, TemplateSelectModalV2 } from "./ApprovalTemplateParts";
import { SchedulerStatusPanel } from "./SchedulerStatusPanel";
import { useApprovalPageController } from "./useApprovalPageController";
import { createApprovalDocumentActions } from "./createApprovalDocumentActions";

export function ApprovalPage({ user, launch, target, portal }: { user: User; launch: ApprovalLaunch | null; target: GlobalSearchTarget | null; portal: "employee" | "admin" }) {
  const managementMode = portal === "admin";
  const controller = useApprovalPageController({ user, launch, target });
  const {
    box,
    setBox,
    dashboardFilter,
    setDashboardFilter,
    approvalCategory,
    setApprovalCategory,
    items,
    setItems,
    listLoading,
    listError,
    retentionAudits,
    setRetentionAudits,
    approvalBoxes,
    setApprovalBoxes,
    selected,
    setSelected,
    equipmentProposal,
    setEquipmentProposal,
    equipmentProposalLoading,
    setEquipmentProposalLoading,
    equipmentCompletionReport,
    setEquipmentCompletionReport,
    mode,
    setMode,
    templates,
    setTemplates,
    adminTemplates,
    setAdminTemplates,
    templateFallbackActive,
    setTemplateFallbackActive,
    templateModalOpen,
    setTemplateModalOpen,
    previewTemplate,
    setPreviewTemplate,
    form,
    setForm,
    leaveUsage,
    setLeaveUsage,
    compTimeSummary,
    setCompTimeSummary,
    holidays,
    setHolidays,
    leaveTypeOptions,
    setLeaveTypeOptions,
    leaveExclusions,
    setLeaveExclusions,
    leavePreviewOpen,
    setLeavePreviewOpen,
    templateAdminForm,
    setTemplateAdminForm,
    templateLineForm,
    setTemplateLineForm,
    pendingFiles,
    setPendingFiles,
    employees,
    setEmployees,
    approvalError,
    setApprovalError,
    defaultLineMessage,
    setDefaultLineMessage,
    savedApprovalLines,
    setSavedApprovalLines,
    selectedSavedLineId,
    setSelectedSavedLineId,
    approvalInfoOpen,
    setApprovalInfoOpen,
    templateAdminMessage,
    setTemplateAdminMessage,
    delegation,
    setDelegation,
    delegationForm,
    setDelegationForm,
    delegationMessage,
    setDelegationMessage,
    operationSettingsForm,
    setOperationSettingsForm,
    operationSettings,
    setOperationSettings,
    operationSettingsMessage,
    setOperationSettingsMessage,
    approvalActionComment,
    setApprovalActionComment,
    approvalSearch,
    setApprovalSearch,
    appliedApprovalSearchScope,
    isApprovalAdmin,
    isHolidayManager,
    isLeavePolicyManager,
    canViewPreview,
    visibleTemplates,
    load,
    loadDeletedApprovals,
    loadRetentionAudits,
    downloadRetentionAuditCsv,
    loadApprovalBoxes,
    loadEmployees,
    loadLeaveUsage,
    changeLeaveBalanceYear,
    loadCompTimeSummary,
    loadHolidays,
    loadLeavePolicies,
    loadActiveTemplates,
    loadSavedApprovalLines,
    loadAdminTemplates,
    loadTemplateDefaultLine,
    applyDefaultLine,
    savePersonalDefaultLine,
    saveNamedApprovalLine,
    applySavedApprovalLine,
    renameSavedApprovalLine,
    deleteSavedApprovalLine,
    rememberSubmittedApprovalLine,
    selectAdminTemplate,
    newAdminTemplate,
    saveTemplateVersion,
    toggleTemplateActive,
    saveTemplateDefaultLine,
    loadDelegation,
    openDelegationSettings,
    saveDelegation,
    deleteDelegation,
    loadDetail,
    refreshEquipmentProposal,
    loadOperationSettings,
    openOperationSettings,
    openHolidayManagement,
    openDeletedApprovals,
    restoreApproval,
    saveOperationSettings,
    changeBox,
    openApprovalWorkView,
    applyApprovalSearch,
    applyApprovalSearchValues,
    changeApprovalCategory,
    resetApprovalSearch,
    updateApprovalSearchFilter,
    openTemplateAdmin
  } = controller;
  const {
    startCreate,
    confirmTemplate,
    editDraft,
    validateDraftLine,
    validateTemplateFieldValues,
    save,
    withdraw,
    redraft,
    action,
    savePurchaseDeliveryDate,
    submitPurchaseApprovalLine,
    saveEquipmentProposalDraft,
    submitEquipmentStage,
    assignEquipmentAssignee,
    correctStatus,
    deleteForRetention,
    managementCancelLeave,
    changeTemplate
  } = createApprovalDocumentActions(user, controller);
  const selectedTemplate = approvalTemplateByCode(templates, form.templateCode) ?? DEFAULT_APPROVAL_TEMPLATES[0];
  const selectableTemplates = selectableApprovalTemplates(visibleTemplates);
  const isClassicDraftForm = isDraftTemplateCode(selectedTemplate.code);
  const isLeaveRequestForm = isLeaveTemplateCode(selectedTemplate.code);
  const isLeaveCancelForm = isLeaveCancelTemplateCode(selectedTemplate.code);
  const isWorkRequestForm = isWorkRequestTemplateCode(selectedTemplate.code);
  const isEmergencyCallRequestForm = isEmergencyCallRequestTemplateCode(selectedTemplate.code);
  const isWorkRequestChangeForm = isWorkRequestChangeTemplateCode(selectedTemplate.code);
  const isPurchaseRequestForm = isPurchaseTemplateCode(selectedTemplate.code);
  const isTrainingRequestForm = isTrainingRequestTemplateCode(selectedTemplate.code);
  const isTrainingReportForm = isTrainingReportTemplateCode(selectedTemplate.code);
  const isEquipmentProposalForm = isEquipmentProposalTemplateCode(selectedTemplate.code);
  const isApprovalEditorMode = mode === "create" || mode === "edit";
  const leaveOverbooked = isLeaveRequestForm
    && Number(leaveUsage?.reservedAnnualDays ?? 0) + Number(form.fieldValues.days ?? 0) > Number(leaveUsage?.remainingAnnualDays ?? 0);
  const isDelegationEligibleForm = isLeaveRequestForm || isTrainingRequestForm || isTrainingReportForm;
  const receiverConflictEmpIds = [...form.agreementEmpIds, ...form.approverEmpIds, ...form.referenceEmpIds];
  const peManagerEmployee = employees.find((employee) => employee.empId === productionEngineeringManagerId(employees));
  const permissions = selected?.permissions;
  const equipmentInputStage = equipmentProposal?.workflowStage === "PE_INPUT" || equipmentProposal?.workflowStage === "PURCHASE_INPUT";
  const primaryApprovalViews = [
    { id: "todo", label: "결재할 문서", box: "pending" as ApprovalBox, dashboardFilter: "actionRequired" as ApprovalDashboardFilter },
    { id: "received", label: "수신함", box: "received" as ApprovalBox },
    { id: "progress", label: "결재진행문서", box: "processed" as ApprovalBox, dashboardFilter: "approvedInProgress" as ApprovalDashboardFilter },
    { id: "drafts", label: "임시보관함", box: "requested" as ApprovalBox, dashboardFilter: "drafts" as ApprovalDashboardFilter }
  ];
  const activePrimaryApprovalViewId = (
    mode !== "templates" && mode !== "delegation" && mode !== "operationSettings" && mode !== "holidays" && mode !== "annualLeaves" && mode !== "leavePolicies" && mode !== "compTime" && mode !== "deleted"
      ? dashboardFilter?.dashboardFilter === "actionRequired" ? "todo"
        : dashboardFilter?.dashboardFilter === "approvedInProgress" ? "progress"
          : dashboardFilter?.dashboardFilter === "drafts" ? "drafts"
            : box === "received" && !dashboardFilter
              ? "received"
              : ""
      : ""
  );
  const isPrimaryDashboardFilter = ["actionRequired", "approvedInProgress", "drafts", "completedInvolved"].includes(dashboardFilter?.dashboardFilter ?? "");
  const approvalListLabel = dashboardFilter?.label ?? (box === "requested" ? "임시보관함" : approvalBoxes.find((item) => item.box === box)?.label ?? "문서");
  const approvalEditorActions = (
    <div className="actions approval-editor-actions">
      <button type="button" className="ghost" onClick={() => setApprovalInfoOpen(true)}><Edit3 size={16} /> {isLeaveRequestForm || isLeaveCancelForm ? "결재 정보 수정" : "결재 정보"}</button>
      <button type="button" className="ghost" title="개인 기본 결재선 저장" onClick={() => void savePersonalDefaultLine()}><Save size={16} /> 기본 결재선 저장</button>
      <button type="button" className="ghost" onClick={() => void save(false)}><Save size={16} /> 임시저장</button>
      {(isLeaveRequestForm || isLeaveCancelForm) && <button type="button" className="ghost" onClick={() => setLeavePreviewOpen(true)}><Eye size={16} /> 미리보기</button>}
      <button type="button" className="approval-submit-action" disabled={leaveOverbooked} title={leaveOverbooked ? "결재 중 휴가를 포함하면 연차를 초과합니다." : undefined} onClick={() => void save(true)}><Check size={16} /> 상신</button>
      <button type="button" className="ghost" onClick={() => selected ? setMode("detail") : setMode("list")}><X size={16} /> 취소</button>
    </div>
  );

  return (
    <section className="panel board-screen approval-screen">
      {!managementMode && !isApprovalEditorMode && <div className="board-tabs approval-tabs approval-category-tabs">
        <button type="button" className={approvalCategory === "active" ? "active" : ""} onClick={() => void changeApprovalCategory("active")}>전자결재</button>
        <button type="button" className={approvalCategory === "completed" ? "active" : ""} onClick={() => void changeApprovalCategory("completed")}>결재 완료문서</button>
      </div>}
      {!managementMode && !isApprovalEditorMode && approvalCategory === "active" && <div className="board-tabs approval-tabs approval-work-tabs">
        {primaryApprovalViews.map((view) => (
          <button key={view.id} className={activePrimaryApprovalViewId === view.id ? "active" : ""} onClick={() => void openApprovalWorkView(view)}>{view.label}</button>
        ))}
        <div className="approval-tab-actions">
          <button type="button" className={mode === "delegation" ? "active" : ""} onClick={() => void openDelegationSettings()}>대리설정</button>
          {mode === "list" && <>
            <button type="button" className="approval-list-refresh" onClick={() => void load(box, dashboardFilter?.dashboardFilter ?? null)}><RefreshCw size={16} /> 새로고침</button>
            <button type="button" className="approval-list-create" onClick={startCreate}><Plus size={16} /> 작성</button>
          </>}
        </div>
      </div>}
      {managementMode && !isApprovalEditorMode && <div className="board-tabs approval-tabs approval-work-tabs approval-admin-tabs">
        <div className="approval-tab-actions">
          {isHolidayManager && <button type="button" className={mode === "compTime" ? "active" : ""} onClick={() => setMode("compTime")}>대체휴무 관리</button>}
          {isApprovalAdmin && <button type="button" className={mode === "templates" ? "active" : ""} onClick={() => void openTemplateAdmin()}>양식관리</button>}
          {isApprovalAdmin && <button type="button" className={mode === "operationSettings" ? "active" : ""} onClick={() => void openOperationSettings()}>운영설정</button>}
          {isHolidayManager && <button type="button" className={mode === "holidays" ? "active" : ""} onClick={openHolidayManagement}>휴일관리</button>}
          {isHolidayManager && <button type="button" className={mode === "annualLeaves" ? "active" : ""} onClick={() => setMode("annualLeaves")}>연차관리</button>}
          {isLeavePolicyManager && <button type="button" className={mode === "leavePolicies" ? "active" : ""} onClick={() => setMode("leavePolicies")}>휴가정책</button>}
          {isApprovalAdmin && <button type="button" className={mode === "deleted" ? "active" : ""} onClick={() => void openDeletedApprovals()}>보존삭제함</button>}
        </div>
      </div>}
      {!managementMode && approvalCategory === "completed" && mode === "list" && <form className="approval-search-panel approval-completed-search" onSubmit={applyApprovalSearch}>
        <label>
          <span>검색어</span>
          <input
            value={approvalSearch.keyword}
            onChange={(event) => setApprovalSearch({ ...approvalSearch, keyword: event.target.value })}
            placeholder="문서번호, 제목, 기안자 검색"
          />
        </label>
        <label>
          <span>상태</span>
          <select value={approvalSearch.status} onChange={(event) => void updateApprovalSearchFilter({ ...approvalSearch, status: event.target.value })}>
            <option value="">전체</option>
            <option value="IN_PROGRESS">진행</option>
            <option value="APPROVED">승인완료</option>
            <option value="REJECTED">반려</option>
            <option value="DRAFT">임시저장</option>
            <option value="WITHDRAWN">회수</option>
            <option value="CANCELED">취소</option>
          </select>
        </label>
        <label>
          <span>양식</span>
          <select value={approvalSearch.templateCode} onChange={(event) => void updateApprovalSearchFilter({ ...approvalSearch, templateCode: event.target.value })}>
            <option value="">전체</option>
            {selectableTemplates.map((template) => (
              <option key={`${template.code}-${template.version ?? "latest"}`} value={template.code}>{template.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>내 역할</span>
          <select value={approvalSearch.role} onChange={(event) => void updateApprovalSearchFilter({ ...approvalSearch, role: event.target.value })}>
            <option value="">전체</option>
            <option value="REQUESTER">기안자</option>
            <option value="APPROVER">결재/합의</option>
            <option value="RECEIVER">수신</option>
            <option value="SHARED">참조/열람</option>
            <option value="DELEGATED">대리 처리</option>
          </select>
        </label>
        <label>
          <span>시작일</span>
          <input type="date" value={approvalSearch.dateFrom} onChange={(event) => void updateApprovalSearchFilter({ ...approvalSearch, dateFrom: event.target.value })} />
        </label>
        <label>
          <span>종료일</span>
          <input type="date" value={approvalSearch.dateTo} onChange={(event) => void updateApprovalSearchFilter({ ...approvalSearch, dateTo: event.target.value })} />
        </label>
        <div className="approval-search-actions">
          <button type="submit"><Search size={16} /> 검색</button>
          <button type="button" className="ghost" onClick={() => void resetApprovalSearch()}><RefreshCw size={16} /> 초기화</button>
        </div>
      </form>}
      {!managementMode && !isApprovalEditorMode && approvalCategory === "completed" && mode === "list" && <Toolbar title="결재 완료문서" onNew={startCreate} onRefresh={() => load(box, dashboardFilter?.dashboardFilter ?? null)} />}
      {managementMode && mode === "list" && (
        <div className="approval-template-editor">
          <div className="panel-head">
            <div>
              <h3>전자결재 관리</h3>
              <p className="muted-text">상단에서 권한이 부여된 관리 기능을 선택해 주세요.</p>
            </div>
          </div>
        </div>
      )}
      {approvalError && <p className="error">{approvalError}</p>}
      {mode === "detail" && selected && (
        <div className={`approval-focus-bar approval-focus-${selected.status.toLowerCase()}`}>
          <div>
            <span className="approval-focus-kicker">{selected.documentNo ?? selected.title}</span>
            <strong>{statusLabel(selected.status)}</strong>
          </div>
          <div className="approval-focus-meta">
            <span>{stageLabel(selected.currentStage)}</span>
            <span>{approvalProgress(selected.lines)}</span>
            {selected.currentApproverName && <span>{selected.currentApproverName}</span>}
          </div>
        </div>
      )}
      {mode === "detail" && selected && (
        <div className="approval-action-panel">
          {permissions?.canApprove && !equipmentInputStage && (
            <label className="approval-comment-input">
              <span>승인 의견</span>
              <textarea
                value={approvalActionComment}
                onChange={(event) => setApprovalActionComment(event.target.value)}
                placeholder="의견이 있으면 입력하세요."
                rows={2}
              />
            </label>
          )}
          <div className="approval-action-layout">
            <div className="approval-actions approval-actions-primary">
              {permissions?.canApprove && !equipmentInputStage && <button className="primary-action" onClick={() => action("approve")}><Check size={16} /> 승인</button>}
              {permissions?.canReject && <button className="danger" onClick={() => action("reject")}><X size={16} /> 반려</button>}
              {permissions?.canSubmit && selected.status !== "IN_PROGRESS" && <button onClick={() => { editDraft(); }}><Check size={16} /> 상신</button>}
              {permissions?.canReceive && <button onClick={() => action("receive")}><Inbox size={16} /> 수신 확인</button>}
              {permissions?.canCompleteReceipt && <button onClick={() => action("complete-receipt")}><Check size={16} /> 접수완료</button>}
            </div>
            <div className="approval-actions approval-actions-secondary">
              {permissions?.canEditDraft && <button className="ghost" onClick={editDraft}><Edit3 size={16} /> 수정</button>}
              {permissions?.canWithdraw && <button className="ghost" onClick={withdraw}><RefreshCw size={16} /> 회수</button>}
              {permissions?.canRedraft && <button className="ghost" onClick={redraft}><Save size={16} /> 재상신</button>}
              {permissions?.canCancel && <button className="ghost" onClick={() => action("cancel")}><X size={16} /> 취소</button>}
              {permissions?.canPrintPdf && selected.pdfStatus === "GENERATED" && selected.pdfFileId != null && <button className="ghost" onClick={() => downloadApprovalPdf(selected.approvalId, selected.documentNo ?? selected.title)}><Paperclip size={16} /> PDF 출력</button>}
            </div>
            {managementMode && isApprovalAdmin && (
              <div className="approval-actions approval-actions-admin">
                <button className="ghost" onClick={() => void correctStatus()}><RefreshCw size={16} /> 상태 보정</button>
                <button className="danger" onClick={() => void deleteForRetention()}><Trash2 size={16} /> 보존삭제</button>
              </div>
            )}
            {managementMode && isHolidayManager && selected.status === "APPROVED" && (isLeaveTemplateCode(selected.templateCode) || isLeaveCancelTemplateCode(selected.templateCode)) && (
              <div className="approval-actions approval-actions-admin"><button className="danger" onClick={() => void managementCancelLeave()}><Trash2 size={16} /> 휴가 관리 취소</button></div>
            )}
          </div>
        </div>
      )}
      {!managementMode && mode === "delegation" && (
        <div className="approval-template-editor">
          <div className="panel-head">
            <div>
              <h3>기본 대리자 설정</h3>
              <p className="muted-text">휴가/교육 결재서에서 대리결재를 켜면, 실제 부재 기간에만 이 사람이 결재를 대신 처리합니다.</p>
            </div>
            <div className="actions">
              <button type="button" onClick={() => void saveDelegation()}><Save size={16} /> 저장</button>
              {delegation && <button type="button" className="ghost" onClick={() => void deleteDelegation()}><X size={16} /> 해제</button>}
            </div>
          </div>
          {delegationMessage && <p className="template-note"><span>{delegationMessage}</span></p>}
          {delegation && (
            <div className="template-note">
              <strong>기본 대리자</strong>
              <span>{delegation.delegateName} · 휴가/교육 결재서에서 켰을 때만 기간 적용</span>
            </div>
          )}
          <div className="template-form">
            <label className="wide">메모<input value={delegationForm.reason} onChange={(event) => setDelegationForm({ ...delegationForm, reason: event.target.value })} placeholder="예: 팀 내 기본 대리자" /></label>
          </div>
          <div className="line-picker-grid">
            <EmployeeMultiPicker
              title="대리자"
              user={user}
              employees={employees}
              selectedIds={delegationForm.delegateEmpId ? [delegationForm.delegateEmpId] : []}
              disabledIds={[user.empId]}
              onChange={(ids) => setDelegationForm({ ...delegationForm, delegateEmpId: ids.length ? ids[ids.length - 1] : null })}
            />
          </div>
        </div>
      )}
      {managementMode && mode === "templates" && isApprovalAdmin && (
        <div className="approval-template-editor">
          <div className="panel-head">
            <div>
              <h3>양식관리</h3>
              <p className="muted-text">양식 수정은 새 버전으로 저장됩니다.</p>
            </div>
            <div className="actions">
              <button type="button" className="ghost" onClick={newAdminTemplate}><Plus size={16} /> 새 양식</button>
              <button type="button" onClick={() => void saveTemplateVersion()}><Save size={16} /> 새 버전 저장</button>
            </div>
          </div>
          {templateAdminMessage && <p className="template-note"><span>{templateAdminMessage}</span></p>}
          <div className="template-switcher">
            {adminTemplates.map((template) => (
              <button type="button" key={`${template.code}-${template.version}`} className={templateAdminForm.templateCode === template.code ? "active" : ""} onClick={() => selectAdminTemplate(template)}>
                <strong>{template.name}</strong>
                <span>{template.code} v{template.version ?? 1} · {template.activeYn === "N" ? "비활성" : "활성"}</span>
              </button>
            ))}
          </div>
          <div className="template-form">
            <label>양식 코드<input value={templateAdminForm.templateCode} onChange={(event) => setTemplateAdminForm({ ...templateAdminForm, templateCode: event.target.value.toUpperCase() })} placeholder="DRAFT" /></label>
            <label>양식명<input value={templateAdminForm.templateName} onChange={(event) => setTemplateAdminForm({ ...templateAdminForm, templateName: event.target.value })} placeholder="기안서" /></label>
            <label>정렬순서<input type="number" value={templateAdminForm.sortOrder} onChange={(event) => setTemplateAdminForm({ ...templateAdminForm, sortOrder: Number(event.target.value) })} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={templateAdminForm.active} onChange={(event) => setTemplateAdminForm({ ...templateAdminForm, active: event.target.checked })} /> 활성 양식</label>
            <label className="wide">설명<input value={templateAdminForm.description} onChange={(event) => setTemplateAdminForm({ ...templateAdminForm, description: event.target.value })} placeholder="양식 설명" /></label>
            <label className="wide">필드 JSON<textarea value={templateAdminForm.fieldsJson} onChange={(event) => setTemplateAdminForm({ ...templateAdminForm, fieldsJson: event.target.value })} /></label>
            <label className="wide">출력 레이아웃 JSON<textarea value={templateAdminForm.printLayoutJson} onChange={(event) => setTemplateAdminForm({ ...templateAdminForm, printLayoutJson: event.target.value })} /></label>
          </div>
          {templateAdminForm.templateCode && (
            <div className="approval-template-line">
              <div className="panel-head">
                <div>
                  <h3>양식별 기본 결재선</h3>
                  <p className="muted-text">{templateAdminForm.templateCode} 양식 작성 시 우선 적용됩니다.</p>
                </div>
                <div className="actions">
                  <button type="button" className="ghost" onClick={() => {
                    const selectedTemplate = adminTemplates.find((template) => template.code === templateAdminForm.templateCode);
                    if (selectedTemplate) void toggleTemplateActive(selectedTemplate, !templateAdminForm.active);
                  }}>{templateAdminForm.active ? <X size={16} /> : <Check size={16} />} {templateAdminForm.active ? "비활성화" : "활성화"}</button>
                  <button type="button" onClick={() => void saveTemplateDefaultLine()}><Save size={16} /> 결재선 저장</button>
                </div>
              </div>
              <div className="line-picker-grid">
                <EmployeeMultiPicker title="합의자" user={user} employees={employees} selectedIds={templateLineForm.agreementEmpIds} disabledIds={[...templateLineForm.approverEmpIds, ...templateLineForm.receiverEmpIds]} onChange={(agreementEmpIds) => setTemplateLineForm({ ...templateLineForm, agreementEmpIds })} />
                <EmployeeMultiPicker title="결재자" user={user} employees={employees} selectedIds={templateLineForm.approverEmpIds} disabledIds={[...templateLineForm.agreementEmpIds, ...templateLineForm.receiverEmpIds]} ordered onChange={(approverEmpIds) => setTemplateLineForm({ ...templateLineForm, approverEmpIds })} />
                <EmployeeMultiPicker title="수신자" user={user} employees={employees} selectedIds={templateLineForm.receiverEmpIds} disabledIds={[...templateLineForm.agreementEmpIds, ...templateLineForm.approverEmpIds, ...templateLineForm.referenceEmpIds]} maxSelections={isLeaveTemplateCode(templateLineForm.templateCode) || isLeaveCancelTemplateCode(templateLineForm.templateCode) ? 1 : undefined} onChange={(receiverEmpIds) => setTemplateLineForm({ ...templateLineForm, receiverEmpIds })} />
                <EmployeeMultiPicker title="참조자" user={user} employees={employees} selectedIds={templateLineForm.referenceEmpIds} disabledIds={templateLineForm.receiverEmpIds} onChange={(referenceEmpIds) => setTemplateLineForm({ ...templateLineForm, referenceEmpIds })} />
                <EmployeeMultiPicker title="연람자" user={user} employees={employees} selectedIds={templateLineForm.readerEmpIds} disabledIds={[]} onChange={(readerEmpIds) => setTemplateLineForm({ ...templateLineForm, readerEmpIds })} />
              </div>
            </div>
          )}
        </div>
      )}
      {managementMode && mode === "operationSettings" && isApprovalAdmin && (
        <div className="approval-template-editor">
          <div className="panel-head">
            <div>
              <h3>운영설정</h3>
              <p className="muted-text">결재 처리 기한과 지연 알림 실행 간격을 관리합니다.</p>
            </div>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => void loadOperationSettings()}><RefreshCw size={16} /> 새로고침</button>
              <button type="button" onClick={() => void saveOperationSettings()}><Save size={16} /> 저장</button>
            </div>
          </div>
          {operationSettingsMessage && <p className="template-note"><span>{operationSettingsMessage}</span></p>}
          <div className="template-form">
            <label>처리 기한(시간)<input type="number" min={1} max={720} value={operationSettingsForm.decisionDueHours} onChange={(event) => setOperationSettingsForm({ ...operationSettingsForm, decisionDueHours: Number(event.target.value) })} /></label>
            <label>지연 알림 간격(ms)<input type="number" min={60000} max={86400000} step={60000} value={operationSettingsForm.reminderFixedDelayMs} onChange={(event) => setOperationSettingsForm({ ...operationSettingsForm, reminderFixedDelayMs: Number(event.target.value) })} /></label>
            <label>보존삭제 문서 보관일수<input type="number" min={30} max={3650} value={operationSettingsForm.deletedDocumentRetentionDays} onChange={(event) => setOperationSettingsForm({ ...operationSettingsForm, deletedDocumentRetentionDays: Number(event.target.value) })} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={operationSettingsForm.permanentDeleteEnabled} onChange={(event) => setOperationSettingsForm({ ...operationSettingsForm, permanentDeleteEnabled: event.target.checked })} /> 영구삭제 허용</label>
          </div>
          <EmployeeMultiPicker
            title="휴가 기본 수신자"
            user={user}
            employees={employees}
            selectedIds={operationSettingsForm.leaveDefaultReceiverEmpId ? [operationSettingsForm.leaveDefaultReceiverEmpId] : []}
            disabledIds={[]}
            maxSelections={1}
            onChange={(ids) => setOperationSettingsForm({ ...operationSettingsForm, leaveDefaultReceiverEmpId: ids[0] ?? null })}
          />
          {operationSettings && (
            <div className="template-note">
              <strong>기본값</strong>
              <span>처리 기한 {operationSettings.fallbackDecisionDueHours}시간 · 알림 간격 {operationSettings.fallbackReminderFixedDelayMs}ms · 보관 {operationSettings.fallbackDeletedDocumentRetentionDays}일 · 영구삭제 {operationSettings.fallbackPermanentDeleteEnabled ? "허용" : "차단"} · 휴가 수신자 {operationSettings.fallbackLeaveDefaultReceiverName ?? "미설정"}</span>
            </div>
          )}
          <SchedulerStatusPanel />
        </div>
      )}
      {managementMode && mode === "holidays" && isHolidayManager && <ApprovalHolidayPanel onChanged={loadHolidays} />}
      {managementMode && mode === "annualLeaves" && isHolidayManager && <AnnualLeaveAdminPanel />}
      {managementMode && mode === "leavePolicies" && isLeavePolicyManager && <LeavePolicyAdminPanel employees={employees} />}
      {managementMode && mode === "compTime" && isHolidayManager && <CompTimeAdminPanel user={user} employees={employees} isManager />}
      {managementMode && mode === "deleted" && isApprovalAdmin && (
        <div className="approval-template-editor">
          <div className="panel-head">
            <div>
              <h3>보존삭제함</h3>
              <p className="muted-text">보존삭제 처리된 전자결재 문서를 조회하고 복구합니다.</p>
            </div>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => void downloadRetentionAuditCsv()}><Download size={16} /> CSV 다운로드</button>
              <button type="button" className="ghost" onClick={() => { void loadDeletedApprovals(); void loadRetentionAudits(); }}><RefreshCw size={16} /> 새로고침</button>
            </div>
          </div>
          {operationSettings && (
            <div className="template-note">
              <strong>보존정책</strong>
              <span>{operationSettings.deletedDocumentRetentionDays}일 보관 · 영구삭제 {operationSettings.permanentDeleteEnabled ? "허용" : "차단"}</span>
            </div>
          )}
          {items.length ? <DeletedApprovalListTable items={items} templates={templates} onRestore={restoreApproval} /> : <Empty text="보존삭제 문서가 없습니다." />}
          <div className="approval-detail-section">
            <h3>보존삭제 감사 리포트</h3>
            {retentionAudits.length ? <ApprovalRetentionAuditTable items={retentionAudits} /> : <Empty text="보존삭제 감사 이력이 없습니다." />}
          </div>
        </div>
      )}
      {!managementMode && mode === "list" && (
        <>
          {dashboardFilter && !isPrimaryDashboardFilter && (
            <div className="approval-filter-banner">
              <span>{dashboardFilter.label} 기준으로 표시 중</span>
              <button type="button" className="ghost" onClick={() => void changeBox(dashboardFilter.box)}>필터 해제</button>
            </div>
          )}
          <ListSummary count={items.length} text={`${approvalListLabel} 문서`} />
          <ListState
            loading={listLoading}
            error={listError}
            hasData={items.length > 0}
            onRetry={() => load(box, dashboardFilter?.dashboardFilter ?? null)}
            empty={<Empty text="결재 문서가 없습니다." />}
            recoveryScope={[box, approvalCategory, dashboardFilter?.dashboardFilter ?? "", appliedApprovalSearchScope].join("|")}
          >
            <ApprovalListTable items={items} templates={templates} onOpen={loadDetail} />
          </ListState>
        </>
      )}
      {mode === "detail" && selected && (
        <DetailPage onBack={() => setMode("list")}>
          <ApprovalDetailView
            user={user}
            approval={selected}
            templates={templates}
            equipmentProposal={equipmentProposal}
            equipmentProposalLoading={equipmentProposalLoading}
            equipmentCompletionReport={equipmentCompletionReport}
            leaveExclusions={leaveExclusions}
            employees={employees}
            onSavePurchaseDeliveryDate={savePurchaseDeliveryDate}
            onSubmitPurchaseApprovalLine={submitPurchaseApprovalLine}
            onSaveEquipment={saveEquipmentProposalDraft}
            onSubmitEquipmentStage={submitEquipmentStage}
            onAssignEquipmentAssignee={assignEquipmentAssignee}
          />
          {isHolidayManager && isLeaveTemplateCode(selected.templateCode) && <LeaveAdminCasePanel approvalId={selected.approvalId} leaveTypes={parseLeaveSelections(approvalDraftData(selected).fieldValues).map((item) => item.type)} />}
          <AttachmentBox targetType="APPROVAL_DOCUMENT" targetId={selected.approvalId} readOnly={!permissions?.canEditDraft} canDownload={!!permissions?.canDownloadAttachment} />
        </DetailPage>
      )}
      {(mode === "create" || mode === "edit") && (
        <DetailPage onBack={() => selected ? setMode("detail") : setMode("list")}>
          <div className={`editor approval-editor${isLeaveRequestForm || isLeaveCancelForm ? " approval-editor-leave" : ""}`}>
            {!(isLeaveRequestForm || isLeaveCancelForm || isWorkRequestForm || isEmergencyCallRequestForm || isWorkRequestChangeForm || isTrainingRequestForm || isTrainingReportForm) && (
              <div className="panel-head">
                <div>
                  <h3>{mode === "edit" ? "전자결재 수정" : "전자결재 작성"}</h3>
                  <p className="muted-text">문서번호는 상신 시 자동 생성됩니다. 예상 형식: {documentPrefix(form.templateCode)}-{new Date().getFullYear()}-자동생성</p>
                </div>
                {approvalEditorActions}
              </div>
            )}
            {defaultLineMessage && <p className="template-note"><span>{defaultLineMessage}</span></p>}
            {approvalInfoOpen && (
              <div className="modal-backdrop" role="presentation">
                <div className="org-picker-modal approval-info-modal" role="dialog" aria-modal="true" aria-label="결재 정보">
                  <div className="modal-head">
                    <h3>결재 정보</h3>
                    <button type="button" className="icon-button" onClick={() => setApprovalInfoOpen(false)}><X size={18} /></button>
                  </div>
                  <div className="approval-line-library">
                    <label>저장된 결재라인
                      <select value={selectedSavedLineId} onChange={(event) => setSelectedSavedLineId(event.target.value)}>
                        {savedApprovalLines.length
                          ? savedApprovalLines.map((line) => <option key={line.defaultLineId ?? line.lineName} value={line.defaultLineId ?? ""}>{line.lineName}</option>)
                          : <option value="">저장된 결재라인 없음</option>}
                      </select>
                    </label>
                    <button type="button" className="ghost" onClick={applySavedApprovalLine} disabled={!savedApprovalLines.length}>불러오기</button>
                    <button type="button" className="ghost" onClick={() => void renameSavedApprovalLine()} disabled={!savedApprovalLines.length}><Edit3 size={16} /> 이름 변경</button>
                    <button type="button" className="danger" onClick={() => void deleteSavedApprovalLine()} disabled={!savedApprovalLines.length}><Trash2 size={16} /> 삭제</button>
                    <button type="button" className="ghost" onClick={() => void saveNamedApprovalLine()}><Save size={16} /> 현재 결재라인 저장</button>
                  </div>
                  <div className="line-picker-grid">
                    <EmployeeMultiPicker title="합의자" user={user} employees={employees} selectedIds={form.agreementEmpIds} disabledIds={[user.empId, ...form.approverEmpIds, ...form.receiverEmpIds]} cardLayout onChange={(agreementEmpIds) => setForm({ ...form, agreementEmpIds })} />
                    <EmployeeMultiPicker title="결재자" user={user} employees={employees} selectedIds={form.approverEmpIds} disabledIds={[user.empId, ...form.agreementEmpIds, ...form.receiverEmpIds]} ordered cardLayout prependUser onChange={(approverEmpIds) => setForm({ ...form, approverEmpIds })} />
                    <EmployeeMultiPicker title="수신자" user={user} employees={employees} selectedIds={form.receiverEmpIds} disabledIds={receiverConflictEmpIds} maxSelections={isLeaveTemplateCode(form.templateCode) || isLeaveCancelTemplateCode(form.templateCode) ? 1 : undefined} cardLayout onChange={(receiverEmpIds) => setForm({ ...form, receiverEmpIds })} />
                    <EmployeeMultiPicker title="참조자" user={user} employees={employees} selectedIds={form.referenceEmpIds} disabledIds={form.receiverEmpIds} cardLayout onChange={(referenceEmpIds) => setForm({ ...form, referenceEmpIds })} />
                  </div>
                  <div className="actions"><button type="button" onClick={() => setApprovalInfoOpen(false)}>적용</button></div>
                </div>
              </div>
            )}
            {isClassicDraftForm && <ClassicDraftEditor user={user} employees={employees} form={form} onChange={setForm} />}
            {(isLeaveRequestForm || isLeaveCancelForm) && <LeaveRequestEditor mode={isLeaveCancelForm ? "cancel" : "request"} user={user} employees={employees} form={form} leaveUsage={leaveUsage} compTimeSummary={compTimeSummary} holidays={holidays} leaveTypeOptions={leaveTypeOptions} headerActions={approvalEditorActions} onBalanceYearChange={isLeaveCancelForm ? (year) => void changeLeaveBalanceYear(year) : undefined} onChange={setForm} />}
            {(isWorkRequestForm || isEmergencyCallRequestForm || isWorkRequestChangeForm) && <WorkRequestEditor mode={isWorkRequestChangeForm ? "change" : isEmergencyCallRequestForm ? "emergency" : "request"} user={user} form={form} headerActions={approvalEditorActions} onChange={setForm} />}
            {leavePreviewOpen && (isLeaveRequestForm || isLeaveCancelForm) && <div className="modal-backdrop"><div className="leave-form-preview-modal"><div className="modal-head"><div><h3>휴가 신청 미리보기</h3><p className="muted-text">현재 입력값 기준이며 상신 전까지 문서는 변경되지 않습니다.</p></div><button className="icon-button" onClick={() => setLeavePreviewOpen(false)}><X size={18} /></button></div><div className="leave-preview-readonly"><LeaveRequestEditor mode={isLeaveCancelForm ? "cancel" : "request"} user={user} employees={employees} form={form} leaveUsage={leaveUsage} compTimeSummary={compTimeSummary} holidays={holidays} leaveTypeOptions={leaveTypeOptions} onChange={() => undefined} /></div></div></div>}
            {isPurchaseRequestForm && <PurchaseRequestEditor user={user} employees={employees} form={form} onChange={setForm} />}
            {isTrainingRequestForm && <TrainingRequestEditor user={user} employees={employees} form={form} headerActions={approvalEditorActions} editingApprovalId={selected?.approvalId} onChange={setForm} />}
            {isTrainingReportForm && <TrainingReportEditor user={user} employees={employees} form={form} headerActions={approvalEditorActions} editingApprovalId={selected?.approvalId} onChange={setForm} />}
            {isEquipmentProposalForm && <EquipmentProposalEditor user={user} employees={employees} form={form} onChange={setForm} />}
            {!isClassicDraftForm && !isLeaveRequestForm && !isLeaveCancelForm && !isWorkRequestForm && !isWorkRequestChangeForm && !isPurchaseRequestForm && !isTrainingRequestForm && !isTrainingReportForm && !isEquipmentProposalForm && (
              <>
            <div className="approval-form-grid">
              <label>양식명<select value={form.templateCode} onChange={(event) => changeTemplate(event.target.value)}>{selectableTemplates.map((template) => <option key={template.code} value={template.code}>{template.name}</option>)}</select></label>
              <label>문서 중요도<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as ApprovalForm["priority"] })}><option value="NORMAL">일반</option><option value="IMPORTANT">중요</option><option value="URGENT">긴급</option></select></label>
              <label className="wide">문서 제목<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="문서 제목" /></label>
              <label className="wide">문서 내용<textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="문서 내용을 입력하세요." /></label>
            </div>
            <div className="template-note"><strong>{selectedTemplate.name}</strong><span>{selectedTemplate.description}</span></div>
            <TemplateFieldInputs
              fields={parseTemplateFields(selectedTemplate.fieldsJson)}
              values={form.fieldValues}
              onChange={(name, value) => setForm({ ...form, fieldValues: { ...form.fieldValues, [name]: value } })}
            />
              </>
            )}
            {isDelegationEligibleForm && (
              <div className="approval-delegation-option">
                <label>
                  <input
                    type="checkbox"
                    checked={form.fieldValues.approvalDelegationEnabled === "Y"}
                    onChange={(event) => setForm({ ...form, fieldValues: { ...form.fieldValues, approvalDelegationEnabled: event.target.checked ? "Y" : "N" } })}
                  />
                  <span>부재 기간에 대리결재 적용</span>
                </label>
                <p>기본 대리자로 지정한 1명에게 실제 휴가/교육 기간에만 결재 권한이 열립니다.</p>
              </div>
            )}
            <DraftAttachmentPicker files={pendingFiles} onChange={setPendingFiles} />
          </div>
        </DetailPage>
      )}
      {templateModalOpen && (
        <TemplateSelectModalV2
          templates={visibleTemplates}
          selected={previewTemplate}
          fallbackActive={templateFallbackActive}
          previewDeptName={currentUserDeptName(user, employees) || "-"}
          previewRequesterName={user.empName}
          onSelect={setPreviewTemplate}
          onCancel={() => setTemplateModalOpen(false)}
          onConfirm={confirmTemplate}
        />
      )}
    </section>
  );
}
