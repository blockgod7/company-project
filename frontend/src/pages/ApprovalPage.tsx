import { ApprovalInfoModal } from "./ApprovalInfoModal";
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
import { downloadApprovalPdf } from "./ApprovalClassicParts";
import { ApprovalHolidayPanel } from "./ApprovalHolidayPanel";
import { AnnualLeaveAdminPanel } from "./AnnualLeaveAdminPanel";
import { LeavePolicyAdminPanel } from "./LeavePolicyAdminPanel";
import { CompTimeAdminPanel } from "./CompTimeAdminPanel";
import { LeaveAdminCasePanel } from "./LeaveAdminCasePanel";
import { ApprovalDetailView } from "./ApprovalParts";
import { APPROVAL_BOXES, isApprovalBox, TemplateSelectModalV2 } from "./ApprovalTemplateParts";
import { ApprovalTemplateAdminWorkspace } from "./ApprovalTemplateAdminWorkspace";
import { ApprovalFormBody } from "./ApprovalFormBody";
import { SchedulerStatusPanel } from "./SchedulerStatusPanel";
import { useApprovalPageController } from "./useApprovalPageController";
import { ApprovalReferenceReadStatus } from "./ApprovalPurchaseTrainingDetails";
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
    approvalLineLibrary,
    approvalInfoOpen,
    setApprovalInfoOpen,
    templateAdminMessage,
    setTemplateAdminMessage,
    templateStatusUpdating,
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
    loadAdminTemplates,
    loadTemplateDefaultLine,
    applyDefaultLine,
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
    { id: "shared", label: "참조문서", box: "shared" as ApprovalBox },
    { id: "progress", label: "결재진행문서", box: "processed" as ApprovalBox, dashboardFilter: "approvedInProgress" as ApprovalDashboardFilter },
    { id: "drafts", label: "임시보관함", box: "requested" as ApprovalBox, dashboardFilter: "drafts" as ApprovalDashboardFilter }
  ];
  const activePrimaryApprovalViewId = (
    mode !== "templates" && mode !== "delegation" && mode !== "operationSettings" && mode !== "holidays" && mode !== "annualLeaves" && mode !== "leavePolicies" && mode !== "compTime" && mode !== "deleted"
      ? dashboardFilter?.dashboardFilter === "actionRequired" ? "todo"
        : dashboardFilter?.dashboardFilter === "approvedInProgress" ? "progress"
          : dashboardFilter?.dashboardFilter === "drafts" ? "drafts"
            : (box === "received" || box === "shared") && !dashboardFilter
              ? box
              : ""
      : ""
  );
  const isPrimaryDashboardFilter = ["actionRequired", "approvedInProgress", "drafts", "completedInvolved"].includes(dashboardFilter?.dashboardFilter ?? "");
  const approvalListLabel = dashboardFilter?.label ?? (box === "requested" ? "임시보관함" : approvalBoxes.find((item) => item.box === box)?.label ?? "문서");
  const formContext = { user, employees, leaveUsage, compTimeSummary, holidays, leaveTypeOptions };
  const approvalEditorActions = (
    <div className="actions approval-editor-actions">
      <button type="button" className="ghost" onClick={() => setApprovalInfoOpen(true)}><Edit3 size={16} /> 결재 정보</button>
      <button type="button" className="ghost" onClick={() => void save(false)}><Save size={16} /> 임시저장</button>
      <button type="button" className="ghost" onClick={() => setLeavePreviewOpen(true)}><Eye size={16} /> 미리보기</button>
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
          <span>처리 결과</span>
          <select value={approvalSearch.status} onChange={(event) => void updateApprovalSearchFilter({ ...approvalSearch, status: event.target.value })}>
            <option value="">전체</option>
            <option value="APPROVED">승인완료</option>
            <option value="REJECTED">반려</option>
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
      {approvalError && !approvalInfoOpen && <p className="error">{approvalError}</p>}
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
              {permissions?.canPrintPdf && selected.pdfStatus === "GENERATED" && selected.pdfFileId != null && <button className="ghost" onClick={() => downloadApprovalPdf(selected.approvalId, selected.documentNo ?? selected.title)}><Paperclip size={16} /> PDF 다운로드/인쇄</button>}
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
        <ApprovalTemplateAdminWorkspace
          user={user}
          employees={employees}
          templates={adminTemplates}
          form={templateAdminForm}
          setForm={setTemplateAdminForm}
          lineForm={templateLineForm}
          setLineForm={setTemplateLineForm}
          message={templateAdminMessage}
          statusUpdating={templateStatusUpdating}
          onNew={newAdminTemplate}
          onSaveVersion={() => void saveTemplateVersion()}
          onSelect={selectAdminTemplate}
          onToggleActive={(template, active) => void toggleTemplateActive(template, active)}
          onSaveDefaultLine={() => void saveTemplateDefaultLine()}
        />
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
          <ListSummary count={items.length} text={box === "shared" && !dashboardFilter ? "참조문서" : `${approvalListLabel} 문서`} />
          {box === "shared" && !dashboardFilter && <p className="muted-text">결재 진행 중인 참조·연람 문서입니다. 읽어도 이곳에 유지되며, 승인·반려로 종료되면 ‘결재 완료문서’에서 내 역할을 ‘참조/열람’으로 선택해 확인할 수 있습니다.</p>}
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
          <ApprovalReferenceReadStatus lines={selected.lines} />
        </DetailPage>
      )}
      {(mode === "create" || mode === "edit") && (
        <DetailPage onBack={() => selected ? setMode("detail") : setMode("list")}>
          <div className={`editor approval-editor${isLeaveRequestForm || isLeaveCancelForm ? " approval-editor-leave" : ""}`}>
            {!(isClassicDraftForm || isPurchaseRequestForm || isLeaveRequestForm || isLeaveCancelForm || isWorkRequestForm || isEmergencyCallRequestForm || isWorkRequestChangeForm || isTrainingRequestForm || isTrainingReportForm || isEquipmentProposalForm) && (
              <div className="panel-head">
                <div>
                  <h3>{mode === "edit" ? "전자결재 수정" : "전자결재 작성"}</h3>
                  <p className="muted-text">문서번호는 상신 시 자동 생성됩니다. 예상 형식: {documentPrefix(form.templateCode)}-{new Date().getFullYear()}-자동생성</p>
                </div>
                {approvalEditorActions}
              </div>
            )}
            {defaultLineMessage && !approvalInfoOpen && <p className="template-note"><span>{defaultLineMessage}</span></p>}
            <ApprovalInfoModal
              open={approvalInfoOpen}
              user={user}
              employees={employees}
              selection={form}
              onChange={(selection) => setForm((current) => ({ ...current, ...selection }))}
              receiverDisabledIds={receiverConflictEmpIds}
              maxReceivers={isLeaveTemplateCode(form.templateCode) || isLeaveCancelTemplateCode(form.templateCode) ? 1 : undefined}
              library={approvalLineLibrary}
              error={approvalError}
              message={defaultLineMessage}
              onClose={() => setApprovalInfoOpen(false)}
            />
            <ApprovalFormBody
              {...formContext}
              form={form}
              template={selectedTemplate}
              templates={selectableTemplates}
              onChange={setForm}
              onTemplateChange={changeTemplate}
              onBalanceYearChange={isLeaveCancelForm ? (year) => void changeLeaveBalanceYear(year) : undefined}
              headerActions={approvalEditorActions}
              editingApprovalId={selected?.approvalId}
            />
            {leavePreviewOpen && <div className="modal-backdrop" role="presentation">
              <div className="leave-form-preview-modal" role="dialog" aria-modal="true" aria-label={`${selectedTemplate.name} 미리보기`}>
                <div className="modal-head">
                  <div><h3>{selectedTemplate.name} 미리보기</h3><p className="muted-text">현재 입력값 기준의 읽기 전용 화면입니다. 결재 정보는 PDF·출력에 포함됩니다.</p></div>
                  <button type="button" className="icon-button" onClick={() => setLeavePreviewOpen(false)} aria-label="미리보기 닫기"><X size={18} /></button>
                </div>
                <ApprovalFormBody {...formContext} form={form} template={selectedTemplate} templates={selectableTemplates} onChange={() => undefined} editingApprovalId={selected?.approvalId} readOnly />
              </div>
            </div>}
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
          context={formContext}
          leaveDefaultReceiverEmpId={operationSettings?.leaveDefaultReceiverEmpId}
          onSelect={setPreviewTemplate}
          onCancel={() => setTemplateModalOpen(false)}
          onConfirm={confirmTemplate}
        />
      )}
    </section>
  );
}
