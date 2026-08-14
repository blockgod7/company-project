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
import { EquipmentProposalEditor, equipmentProposalContent, LeaveRequestEditor, PurchaseRequestEditor, TemplateFieldInputs, TrainingReportEditor, TrainingRequestEditor } from "./ApprovalFormParts";
import { APPROVAL_BOXES, isApprovalBox, TemplateSelectModalV2 } from "./ApprovalTemplateParts";
import { SchedulerStatusPanel } from "./SchedulerStatusPanel";
import { useApprovalPageController } from "./useApprovalPageController";
type ApprovalPageController = ReturnType<typeof useApprovalPageController>;

export function createApprovalDocumentActions(user: User, controller: ApprovalPageController) {
  const {
    box,
    setBox,
    dashboardFilter,
    setDashboardFilter,
    approvalCategory,
    setApprovalCategory,
    items,
    setItems,
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
  function startCreate() {
    const selectableTemplates = selectableApprovalTemplates(visibleTemplates);
    if (!selectableTemplates.length) {
      setApprovalError("사용 가능한 결재 양식이 없습니다. 관리자에게 양식 활성화를 요청해 주세요.");
      return;
    }
    setDashboardFilter(null);
    setSelected(null);
    setPendingFiles([]);
    setApprovalError("");
    setPreviewTemplate(selectableTemplates[0]);
    setTemplateModalOpen(true);
  }

  function confirmTemplate() {
    const peManagerId = productionEngineeringManagerId(employees);
    const requesterDeptName = currentUserDeptName(user, employees);
    const isLeaveRequest = isLeaveTemplateCode(previewTemplate.code);
    const isLeaveCancel = isLeaveCancelTemplateCode(previewTemplate.code);
    const isPurchaseRequest = isPurchaseTemplateCode(previewTemplate.code);
    const isTrainingRequest = isTrainingRequestTemplateCode(previewTemplate.code);
    const isTrainingReport = isTrainingReportTemplateCode(previewTemplate.code);
    const isTrainingTemplate = isTrainingTemplateCode(previewTemplate.code);
    const isEquipmentProposal = isEquipmentProposalTemplateCode(previewTemplate.code);
    const leaveReceiverEmpId = leaveReceiverId(employees, operationSettings?.leaveDefaultReceiverEmpId);
    const purchaseReceiverEmpId = purchaseReceiverId(employees);
    const trainingReceiverEmpId = trainingReceiverId(employees);
    setForm({
      ...defaultApprovalForm([previewTemplate]),
      title: isPurchaseRequest || isTrainingTemplate || isEquipmentProposal ? "" : previewTemplate.name,
      fieldValues: isEquipmentProposal
        ? { requestDeptName: requesterDeptName }
        : isPurchaseRequest
          ? purchaseDefaultFieldValues(user, employees)
        : isTrainingRequest
          ? trainingRequestDefaultFieldValues(user, employees)
        : isTrainingReport
          ? trainingReportDefaultFieldValues(user, employees)
        : isLeaveRequest || isLeaveCancel
          ? leaveUsageFieldValues(leaveUsage)
          : {},
      receiverEmpIds: (isLeaveRequest || isLeaveCancel) && leaveReceiverEmpId ? [leaveReceiverEmpId] : isPurchaseRequest && purchaseReceiverEmpId ? [purchaseReceiverEmpId] : isTrainingTemplate && trainingReceiverEmpId ? [trainingReceiverEmpId] : isEquipmentProposal && peManagerId ? [peManagerId] : []
    });
    setDefaultLineMessage("");
    setTemplateModalOpen(false);
    setMode("create");
    void applyDefaultLine(previewTemplate.code);
    if (isLeaveRequest || isLeaveCancel) {
      void loadCompTimeSummary();
      void loadLeaveUsage().then((usage) => {
        setForm((current) => isLeaveTemplateCode(current.templateCode) || isLeaveCancelTemplateCode(current.templateCode)
          ? { ...current, fieldValues: { ...current.fieldValues, ...leaveUsageFieldValues(usage) } }
          : current
        );
      });
    }
  }

  function editDraft() {
    if (!selected || !selected.permissions?.canEditDraft) return;
    const draftData = approvalDraftData(selected);
    const template = approvalTemplateByCode(templates, selected.templateCode) ?? DEFAULT_APPROVAL_TEMPLATES[0];
    setForm({
      title: selected.title,
      content: draftData.content,
      fieldValues: draftData.fieldValues,
      templateCode: selected.templateCode ?? template.code,
      templateVersion: selected.templateVersion ?? template.version ?? null,
      priority: selected.priority,
      agreementEmpIds: selected.lines.filter((line) => line.lineType === "AGREEMENT").map((line) => line.assignedEmpId ?? line.approverEmpId),
      approverEmpIds: selected.lines.filter((line) => line.lineType === "APPROVAL").map((line) => line.assignedEmpId ?? line.approverEmpId),
      receiverEmpIds: selected.lines.filter((line) => line.lineType === "RECEIVER").map((line) => line.assignedEmpId ?? line.approverEmpId),
      referenceEmpIds: selected.lines.filter((line) => line.lineType === "REFERENCE").map((line) => line.assignedEmpId ?? line.approverEmpId),
      readerEmpIds: selected.lines.filter((line) => line.lineType === "READER").map((line) => line.assignedEmpId ?? line.approverEmpId)
    });
    setPendingFiles([]);
    setApprovalError("");
    setMode("edit");
    if (isLeaveTemplateCode(selected.templateCode) || isLeaveCancelTemplateCode(selected.templateCode)) {
      const selectedYear = Number(parseLeaveSelections(draftData.fieldValues)[0]?.date.slice(0, 4));
      void loadLeaveUsage(Number.isInteger(selectedYear) ? selectedYear : undefined);
      void loadCompTimeSummary();
    }
  }

  function validateDraftLine(receiverEmpIds = form.receiverEmpIds) {
    if (form.agreementEmpIds.includes(user.empId) || form.approverEmpIds.includes(user.empId)) {
      return "기안자 본인은 합의자 또는 결재자로 지정할 수 없습니다.";
    }
    const decisionIds = [...form.agreementEmpIds, ...form.approverEmpIds];
    if (new Set(decisionIds).size !== decisionIds.length) {
      return "합의자와 결재자는 중복 지정할 수 없습니다.";
    }
    if (receiverEmpIds.some((empId) => decisionIds.includes(empId) || form.referenceEmpIds.includes(empId))) {
      return "수신자는 결재자, 합의자 또는 참조자로 중복 지정할 수 없습니다.";
    }
    if (!form.approverEmpIds.length) {
      return "상신 전 결재자를 1명 이상 선택해 주세요.";
    }
    return "";
  }

  function validateTemplateFieldValues(template: ApprovalTemplateOption, values: Record<string, string> = form.fieldValues) {
    const requiredField = parseTemplateFields(template.fieldsJson)
      .find((field) => isRequiredTemplateField(field) && !values[field.name]?.trim());
    return requiredField ? `${requiredField.label} 필수값을 입력해 주세요.` : "";
  }

  async function save(submit = true) {
    setApprovalError("");
    const template = approvalTemplateByCode(templates, form.templateCode);
    if (!template) {
      setApprovalError("선택한 결재 양식을 찾을 수 없습니다. 양식을 다시 선택해 주세요.");
      return;
    }
    const isEquipmentProposal = isEquipmentProposalTemplateCode(template.code);
    const isLeaveRequest = isLeaveTemplateCode(template.code);
    const isLeaveCancel = isLeaveCancelTemplateCode(template.code);
    const isPurchaseRequest = isPurchaseTemplateCode(template.code);
    const isTrainingRequest = isTrainingRequestTemplateCode(template.code);
    const isTrainingReport = isTrainingReportTemplateCode(template.code);
    const isTrainingTemplate = isTrainingTemplateCode(template.code);
    const isLeaveFlow = isLeaveRequest || isLeaveCancel;
    const isDelegationEligible = isLeaveRequest || isTrainingRequest || isTrainingReport;
    const peManagerId = productionEngineeringManagerId(employees);
    const purchaseReceiverEmpId = purchaseReceiverId(employees);
    const trainingReceiverEmpId = trainingReceiverId(employees);
    const receiverEmpIds = isLeaveFlow ? form.receiverEmpIds : isPurchaseRequest && purchaseReceiverEmpId ? [purchaseReceiverEmpId] : isTrainingTemplate && trainingReceiverEmpId ? [trainingReceiverEmpId] : isEquipmentProposal && peManagerId ? [peManagerId] : form.receiverEmpIds;
    const requesterDeptName = currentUserDeptName(user, employees, form.fieldValues.requestDeptName ?? "");
    const baseFieldValues = isEquipmentProposalTemplateCode(template.code)
      ? { ...form.fieldValues, requestDeptName: requesterDeptName }
      : isPurchaseRequest
        ? purchaseDefaultFieldValues(user, employees, form.fieldValues)
      : isTrainingRequest
        ? trainingRequestDefaultFieldValues(user, employees, form.fieldValues)
      : isTrainingReport
        ? trainingReportDefaultFieldValues(user, employees, form.fieldValues)
      : form.fieldValues;
    const fieldValues = isDelegationEligible
      ? { ...baseFieldValues, approvalDelegationEnabled: baseFieldValues.approvalDelegationEnabled ?? "N" }
      : baseFieldValues;
    const content = isEquipmentProposalTemplateCode(template.code)
      ? equipmentProposalContent(fieldValues, template.code)
      : isLeaveRequest
        ? leaveRequestContent(fieldValues)
        : isLeaveCancel
          ? leaveCancelContent(fieldValues)
          : isPurchaseRequest
            ? purchaseRequestContent(fieldValues)
          : isTrainingRequest
            ? trainingRequestContent(fieldValues)
          : isTrainingReport
            ? trainingReportContent(fieldValues)
        : form.content;
    if (submit) {
      if (isLeaveFlow && receiverEmpIds.length !== 1) {
        setApprovalError("휴가 문서 수신자를 1명 지정해 주세요.");
        return;
      }
      if (isLeaveRequest) {
        const requestedCompTimeDays = parseLeaveSelections(fieldValues)
          .filter((selection) => selection.type === "대체휴무")
          .length;
        if (requestedCompTimeDays > Number(compTimeSummary?.availableDays ?? 0)) {
          setApprovalError(`대체휴무 잔여가 부족합니다. 사용 가능 ${formatDayValue(compTimeSummary?.availableDays ?? 0)}일`);
          return;
        }
      }
      if ((isEquipmentProposalTemplateCode(template.code) || isPurchaseRequest || isTrainingTemplate) && !form.title.trim()) {
        setApprovalError("문서 제목 필수값을 입력해 주세요.");
        return;
      }
      if (isPurchaseRequest) {
        const purchaseValidation = validatePurchaseRequest(fieldValues, form.title);
        if (purchaseValidation) {
          setApprovalError(purchaseValidation);
          return;
        }
      }
      if (isTrainingRequest) {
        const trainingValidation = validateTrainingRequest(fieldValues, form.title, receiverEmpIds);
        if (trainingValidation) {
          setApprovalError(trainingValidation);
          return;
        }
      }
      if (isTrainingReport) {
        const trainingReportValidation = validateTrainingReport(fieldValues, form.title, receiverEmpIds);
        if (trainingReportValidation) {
          setApprovalError(trainingReportValidation);
          return;
        }
      }
      const validation = validateDraftLine(receiverEmpIds);
      if (validation) {
        setApprovalError(validation);
        return;
      }
      const fieldValidation = validateTemplateFieldValues(template, fieldValues);
      if (fieldValidation) {
        setApprovalError(fieldValidation);
        return;
      }
    }
    try {
      const payload = {
        title: form.title.trim() || template.name,
        content,
        templateCode: template.code,
        templateVersion: template.version ?? form.templateVersion,
        formDataJson: JSON.stringify({
          content,
          fields: fieldValues,
          agreementEmpIds: form.agreementEmpIds,
          approverEmpIds: form.approverEmpIds,
          receiverEmpIds,
          referenceEmpIds: form.referenceEmpIds,
          readerEmpIds: form.readerEmpIds
        }),
        priority: form.priority,
        agreementEmpIds: form.agreementEmpIds,
        approverEmpIds: form.approverEmpIds,
        receiverEmpIds,
        referenceEmpIds: form.referenceEmpIds,
        readerEmpIds: form.readerEmpIds,
        draft: !submit
      };
      const editing = mode === "edit" && selected && selected.permissions?.canEditDraft;
      let saved: Approval;
      if (editing) {
        if (submit) {
          await uploadAttachments("APPROVAL_DOCUMENT", selected.approvalId, pendingFiles);
          saved = await api<Approval>(`/approvals/${selected.approvalId}/submit`, { method: "POST", body: jsonBody({ ...payload, draft: false }) });
        } else {
          saved = await api<Approval>(`/approvals/${selected.approvalId}/draft`, { method: "PUT", body: jsonBody({ ...payload, draft: true }) });
          await uploadAttachments("APPROVAL_DOCUMENT", saved.approvalId, pendingFiles);
        }
      } else if (submit) {
        const draft = await api<Approval>("/approvals/drafts", { method: "POST", body: jsonBody({ ...payload, draft: true }) });
        await uploadAttachments("APPROVAL_DOCUMENT", draft.approvalId, pendingFiles);
        saved = await api<Approval>(`/approvals/${draft.approvalId}/submit`, { method: "POST", body: jsonBody({ ...payload, draft: false }) });
      } else {
        saved = await api<Approval>("/approvals/drafts", { method: "POST", body: jsonBody({ ...payload, draft: true }) });
        await uploadAttachments("APPROVAL_DOCUMENT", saved.approvalId, pendingFiles);
      }
      if (submit) {
        await rememberSubmittedApprovalLine(form);
      }
      setPendingFiles([]);
      setForm(defaultApprovalForm(templates));
      await refreshEquipmentProposal(saved);
      setSelected(saved);
      setMode("detail");
      setBox("requested");
      if (isLeaveRequest || isLeaveCancel) {
        await loadCompTimeSummary();
      }
      await load("requested");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "결재 문서 저장 중 오류가 발생했습니다.");
    }
  }

  async function withdraw() {
    if (!selected || !window.confirm("아직 합의/결재 처리되지 않은 문서를 회수합니다.")) return;
    const reason = window.prompt("회수 사유", "수정 후 재상신") ?? "";
    const updated = await api<Approval>(`/approvals/${selected.approvalId}/actions/withdraw`, { method: "POST", body: jsonBody({ comment: reason }) });
    setSelected(updated);
    await load(box);
  }

  async function redraft() {
    if (!selected) return;
    const draft = await api<Approval>(`/approvals/${selected.approvalId}/actions/redraft`, { method: "POST" });
    setSelected(draft);
    setMode("detail");
    setBox("requested");
    await load("requested");
  }

  async function action(type: "approve" | "reject" | "receive" | "complete-receipt" | "cancel") {
    if (!selected) return;
    let comment = "";
    if (type === "approve") {
      comment = approvalActionComment.trim();
    }
    if (type === "reject") {
      comment = window.prompt("반려 사유를 입력해 주세요.") ?? "";
      if (!comment.trim()) {
        setApprovalError("반려 사유를 입력해 주세요.");
        return;
      }
    }
    if (type === "complete-receipt") {
      comment = window.prompt("접수완료 의견", "접수완료") ?? "";
    }
    try {
      const updated = await api<Approval>(`/approvals/${selected.approvalId}/actions/${type}`, {
        method: "POST",
        body: comment ? jsonBody({ comment }) : undefined
      });
      setSelected(updated);
      if (type === "approve") {
        setApprovalActionComment("");
      }
      if (type === "approve" && (isLeaveTemplateCode(updated.templateCode) || isLeaveCancelTemplateCode(updated.templateCode)) && updated.status === "APPROVED") {
        await loadLeaveUsage();
        await loadCompTimeSummary();
      }
      await refreshEquipmentProposal(updated);
      setApprovalError("");
      await load(box);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "결재 처리 중 오류가 발생했습니다.");
    }
  }

  async function savePurchaseDeliveryDate(deliveryDate: string) {
    if (!selected) return;
    try {
      const updated = await api<Approval>(`/approvals/${selected.approvalId}/purchase-request`, {
        method: "PATCH",
        body: jsonBody({ deliveryDate })
      });
      setSelected(updated);
      setApprovalError("");
      await load(box);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "구매요구서 입고일 저장 중 오류가 발생했습니다.");
    }
  }

  async function submitPurchaseApprovalLine(agreementEmpIds: number[], approverEmpIds: number[]) {
    if (!selected) return;
    if (!approverEmpIds.length) {
      setApprovalError("구매팀 결재자를 1명 이상 선택해 주세요.");
      return;
    }
    try {
      const updated = await api<Approval>(`/approvals/${selected.approvalId}/purchase-request/submit-approval`, {
        method: "POST",
        body: jsonBody({ agreementEmpIds, approverEmpIds })
      });
      setSelected(updated);
      setApprovalError("");
      await load(box);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "구매팀 결재 상신 중 오류가 발생했습니다.");
    }
  }

  async function saveEquipmentProposalDraft(next: Partial<EquipmentProposal>) {
    if (!selected || !equipmentProposal) return;
    try {
      const saved = await api<EquipmentProposal>(`/approvals/${selected.approvalId}/equipment-proposal`, {
        method: "PATCH",
        body: jsonBody({ ...equipmentProposal, ...next })
      });
      setEquipmentProposal(saved);
      setApprovalError("");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "설비 품의서 저장 중 오류가 발생했습니다.");
    }
  }

  async function submitEquipmentStage(stage: "pe" | "purchase", next: Partial<EquipmentProposal>) {
    if (!selected || !equipmentProposal) return;
    try {
      const saved = await api<EquipmentProposal>(`/approvals/${selected.approvalId}/equipment-proposal/submit-${stage}`, {
        method: "POST",
        body: jsonBody({ ...equipmentProposal, ...next })
      });
      setEquipmentProposal(saved);
      setApprovalError("");
      await load(box);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "설비 품의서 단계 제출 중 오류가 발생했습니다.");
    }
  }

  async function assignEquipmentAssignee(type: "pe" | "purchase", empId: number) {
    if (!selected || !equipmentProposal) return;
    try {
      const saved = await api<EquipmentProposal>(`/approvals/${selected.approvalId}/equipment-proposal/assign-${type}`, {
        method: "POST",
        body: jsonBody(type === "pe" ? { peAssigneeEmpId: empId } : { purchaseAssigneeEmpId: empId })
      });
      setEquipmentProposal(saved);
      setApprovalError("");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "담당자 변경 중 오류가 발생했습니다.");
    }
  }

  async function correctStatus() {
    if (!selected) return;
    const comment = window.prompt("상태 보정 사유", "운영자 상태 보정") ?? "";
    try {
      const updated = await api<Approval>(`/approvals/${selected.approvalId}/actions/status-correction`, {
        method: "POST",
        body: jsonBody({ comment })
      });
      setSelected(updated);
      setApprovalError("");
      await load(box);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "상태 보정 중 오류가 발생했습니다.");
    }
  }

  async function deleteForRetention() {
    if (!selected) return;
    if (!window.confirm("문서를 물리 삭제하지 않고 보존삭제 처리합니다. 진행/승인 문서는 서버 정책상 차단됩니다.")) return;
    const comment = window.prompt("보존삭제 사유", "운영자 보존삭제") ?? "";
    try {
      await api<void>(`/approvals/${selected.approvalId}`, {
        method: "DELETE",
        body: jsonBody({ comment })
      });
      setSelected(null);
      setMode("list");
      setApprovalError("");
      await load(box);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "문서 보존삭제 중 오류가 발생했습니다.");
    }
  }

  async function managementCancelLeave() {
    if (!selected) return;
    const comment = window.prompt("승인 휴가 관리 취소 사유를 입력하세요.", "휴가관리자 관리 취소")?.trim();
    if (!comment) return;
    if (!window.confirm("승인 문서를 관리 취소하고 해당 휴가 사용량을 복원할까요? 과거 날짜도 취소할 수 있으며 원본과 감사 이력은 보존됩니다.")) return;
    try {
      const updated = await api<Approval>(`/approvals/${selected.approvalId}/management-cancel-leave`, { method: "POST", body: jsonBody({ comment }) });
      setSelected(updated); setApprovalError(""); await loadLeaveUsage(); await load(box);
    } catch (err) { setApprovalError(err instanceof Error ? err.message : "승인 휴가를 관리 취소하지 못했습니다."); }
  }

  function changeTemplate(templateCode: string) {
    const nextTemplate = approvalTemplateByCode(templates, templateCode) ?? DEFAULT_APPROVAL_TEMPLATES[0];
    const currentTemplate = approvalTemplateByCode(templates, form.templateCode);
    const shouldUseTemplateTitle = !form.title.trim() || form.title === currentTemplate?.name;
    const isEquipmentProposal = isEquipmentProposalTemplateCode(templateCode);
    const isLeaveRequest = isLeaveTemplateCode(templateCode);
    const isLeaveCancel = isLeaveCancelTemplateCode(templateCode);
    const isPurchaseRequest = isPurchaseTemplateCode(templateCode);
    const isTrainingRequest = isTrainingRequestTemplateCode(templateCode);
    const isTrainingReport = isTrainingReportTemplateCode(templateCode);
    const isTrainingTemplate = isTrainingTemplateCode(templateCode);
    const peManagerId = productionEngineeringManagerId(employees);
    const leaveReceiverEmpId = leaveReceiverId(employees, operationSettings?.leaveDefaultReceiverEmpId);
    const purchaseReceiverEmpId = purchaseReceiverId(employees);
    const trainingReceiverEmpId = trainingReceiverId(employees);
    const requesterDeptName = currentUserDeptName(user, employees, form.fieldValues.requestDeptName ?? "");
    setForm({
      ...form,
      templateCode,
      templateVersion: nextTemplate.version ?? null,
      title: isPurchaseRequest || isTrainingTemplate || isEquipmentProposal ? "" : shouldUseTemplateTitle ? nextTemplate.name : form.title,
      fieldValues: isEquipmentProposal ? { requestDeptName: requesterDeptName } : isPurchaseRequest ? purchaseDefaultFieldValues(user, employees) : isTrainingRequest ? trainingRequestDefaultFieldValues(user, employees) : isTrainingReport ? trainingReportDefaultFieldValues(user, employees) : isLeaveRequest || isLeaveCancel ? leaveUsageFieldValues(leaveUsage) : {},
      receiverEmpIds: (isLeaveRequest || isLeaveCancel) && leaveReceiverEmpId ? [leaveReceiverEmpId] : isPurchaseRequest && purchaseReceiverEmpId ? [purchaseReceiverEmpId] : isTrainingTemplate && trainingReceiverEmpId ? [trainingReceiverEmpId] : isEquipmentProposal && peManagerId ? [peManagerId] : []
    });
    setDefaultLineMessage("");
    void applyDefaultLine(templateCode);
    if (isLeaveRequest || isLeaveCancel) {
      void loadLeaveUsage().then((usage) => {
        setForm((current) => current.templateCode === templateCode
          ? { ...current, fieldValues: { ...current.fieldValues, ...leaveUsageFieldValues(usage) } }
          : current
        );
      });
    }
  }

  return {
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
  };
}
