import { hrReceiverId, isHrDefaultReceiverTemplateCode } from "../utils/approvalDomainCore";
import { useApprovalLineLibrary } from "./useApprovalLineLibrary";
import { FormEvent, useEffect, useRef, useState } from "react";
import { api, authenticatedFetch, jsonBody } from "../api";
import type { DraftAttachment } from "../utils/attachments";
import { templateName } from "../utils/approvalLabels";
import {
  APPROVAL_BOXES,
  isApprovalBox
} from "./ApprovalTemplateParts";
import {
  DEFAULT_APPROVAL_SEARCH,
  DEFAULT_APPROVAL_TEMPLATES,
  defaultApprovalForm,
  defaultDelegationForm,
  defaultLineIds,
  defaultLinePayload,
  defaultOperationSettingsForm,
  ENABLE_TEMPLATE_FALLBACK,
  firstSelectableApprovalTemplate,
  isEquipmentProposalTemplateCode,
  isLeaveCancelTemplateCode,
  isLeaveTemplateCode,
  isWorkRequestTemplateCode,
  isWorkRequestChangeTemplateCode,
  isPurchaseTemplateCode,
  isTrainingRequestTemplateCode,
  isTrainingTemplateCode,
  LEAVE_TYPE_OPTIONS,
  leaveReceiverId,
  leaveUsageFieldValues,
  equipmentProposalReceiverId,
  isProductionEngineeringRequester,
  purchaseRequestReceiverId,
  selectableLeaveTypeOptions,
  templateAdminFormFromOption,
  templateOptionFromApi,
  todayDate,
  trainingReceiverId,
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
  ApprovalTemplateOption,
  ContentMode
} from "../utils/approvalDomain";
import { canViewPlannedFeatures } from "../navigation";
import type { GlobalSearchTarget } from "../utils/search";
import type {
  Approval,
  ApprovalDelegationApi,
  ApprovalDefaultLineApi,
  ApprovalHoliday,
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


function equipmentCompletionReportId(approval: Approval): number | null {
  if (approval.templateCode !== "EQUIPMENT_WORK_COMPLETION" || !approval.formDataJson) return null;
  try {
    const reportId = JSON.parse(approval.formDataJson).reportId;
    return typeof reportId === "number" && Number.isInteger(reportId) ? reportId : null;
  } catch {
    return null;
  }
}

function approvalSearchScope(search: ApprovalSearchForm) {
  return [
    search.keyword,
    search.status,
    search.templateCode,
    search.role,
    search.dateFrom,
    search.dateTo
  ].map((value) => encodeURIComponent(value.trim())).join("|");
}

export function useApprovalPageController({ user, launch, target }: { user: User; launch: ApprovalLaunch | null; target: GlobalSearchTarget | null }) {
  const [box, setBox] = useState<ApprovalBox>(launch?.box ?? "pending");
  const [dashboardFilter, setDashboardFilter] = useState<ApprovalLaunch | null>(launch);
  const [approvalCategory, setApprovalCategory] = useState<ApprovalCategory>("active");
  const [items, setItems] = useState<ApprovalSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");
  const listRequestId = useRef(0);
  const defaultLineRequestId = useRef(0);
  const [retentionAudits, setRetentionAudits] = useState<AuditLog[]>([]);
  const [approvalBoxes, setApprovalBoxes] = useState<{ box: ApprovalBox; label: string }[]>(APPROVAL_BOXES);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [equipmentProposal, setEquipmentProposal] = useState<EquipmentProposal | null>(null);
  const [equipmentProposalLoading, setEquipmentProposalLoading] = useState(false);
  const [equipmentCompletionReport, setEquipmentCompletionReport] = useState<EquipmentReport | null>(null);
  const [mode, setMode] = useState<ContentMode>("list");
  const [templates, setTemplates] = useState<ApprovalTemplateOption[]>(DEFAULT_APPROVAL_TEMPLATES);
  const [adminTemplates, setAdminTemplates] = useState<ApprovalTemplateOption[]>([]);
  const [templateFallbackActive, setTemplateFallbackActive] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<ApprovalTemplateOption>(DEFAULT_APPROVAL_TEMPLATES[0]);
  const [form, setForm] = useState<ApprovalForm>(() => defaultApprovalForm());
  const [leaveUsage, setLeaveUsage] = useState<LeaveUsage | null>(null);
  const [compTimeSummary, setCompTimeSummary] = useState<CompTimeSummary | null>(null);
  const [holidays, setHolidays] = useState<ApprovalHoliday[]>([]);
  const [leaveTypeOptions, setLeaveTypeOptions] = useState<string[]>(LEAVE_TYPE_OPTIONS);
  const [leaveExclusions, setLeaveExclusions] = useState<LeaveExclusion[]>([]);
  const [leavePreviewOpen, setLeavePreviewOpen] = useState(false);
  const [templateAdminForm, setTemplateAdminForm] = useState<ApprovalTemplateAdminForm>(() => templateAdminFormFromOption());
  const [templateLineForm, setTemplateLineForm] = useState<ApprovalForm>(() => defaultApprovalForm());
  const [pendingFiles, setPendingFiles] = useState<DraftAttachment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [approvalError, setApprovalError] = useState("");
  const [defaultLineMessage, setDefaultLineMessage] = useState("");
  const approvalLineLibrary = useApprovalLineLibrary({
    selection: form,
    onApply: (selection) => setForm((current) => ({ ...current, ...selection })),
    setApprovalError,
    setDefaultLineMessage
  });
  const [approvalInfoOpen, setApprovalInfoOpen] = useState(false);
  const [templateAdminMessage, setTemplateAdminMessage] = useState("");
  const [templateStatusUpdating, setTemplateStatusUpdating] = useState(false);
  const [delegation, setDelegation] = useState<ApprovalDelegationApi | null>(null);
  const [delegationForm, setDelegationForm] = useState<ApprovalDelegationForm>(() => defaultDelegationForm());
  const [delegationMessage, setDelegationMessage] = useState("");
  const [operationSettingsForm, setOperationSettingsForm] = useState<ApprovalOperationSettingsForm>(() => defaultOperationSettingsForm());
  const [operationSettings, setOperationSettings] = useState<ApprovalOperationSettings | null>(null);
  const [operationSettingsMessage, setOperationSettingsMessage] = useState("");
  const [approvalActionComment, setApprovalActionComment] = useState("");
  const [approvalSearch, setApprovalSearch] = useState<ApprovalSearchForm>(DEFAULT_APPROVAL_SEARCH);
  const [appliedApprovalSearchScope, setAppliedApprovalSearchScope] = useState(() => approvalSearchScope(DEFAULT_APPROVAL_SEARCH));
  const isFullAdmin = user.roleCode === "ADMIN" || user.permissions.includes("FULL_ADMIN");
  const isApprovalAdmin = isFullAdmin || user.roleCode === "APPROVAL_ADMIN";
  const isHolidayManager = isFullAdmin || user.permissions.includes("LEAVE_ADMIN");
  const isLeavePolicyManager = isFullAdmin || user.permissions.includes("LEAVE_POLICY_ADMIN");
  const canViewPreview = canViewPlannedFeatures(user);
  // The public template API already returns only the latest active templates.
  const visibleTemplates = templates;

  async function load(
    targetBox: ApprovalBox,
    targetFilter: ApprovalDashboardFilter | null | undefined = dashboardFilter?.dashboardFilter,
    search: ApprovalSearchForm | null = approvalCategory === "completed" ? approvalSearch : null
  ) {
    const requestId = ++listRequestId.current;
    setListLoading(true);
    setListError("");
    const params = new URLSearchParams({ box: targetBox, size: "30" });
    if (targetFilter) params.set("dashboardFilter", targetFilter);
    if (search) {
      Object.entries(search).forEach(([key, value]) => {
        const trimmed = value.trim();
        if (trimmed) params.set(key, trimmed);
      });
    }
    try {
      const page = await api<PageResponse<ApprovalSummary>>(`/approvals?${params.toString()}`);
      if (requestId === listRequestId.current) setItems(page.content);
    } catch (reason) {
      if (requestId === listRequestId.current) {
        setListError(reason instanceof Error ? reason.message : "잠시 후 다시 시도해 주세요.");
      }
    } finally {
      if (requestId === listRequestId.current) setListLoading(false);
    }
  }

  async function loadDeletedApprovals() {
    const page = await api<PageResponse<ApprovalSummary>>("/approvals/deleted?size=30");
    setItems(page.content);
  }

  async function loadRetentionAudits() {
    const page = await api<PageResponse<AuditLog>>("/approvals/retention-audits?size=100");
    setRetentionAudits(page.content);
  }

  async function downloadRetentionAuditCsv() {
    try {
      const response = await authenticatedFetch("/approvals/retention-audits/export");
      if (!response.ok) throw new Error("보존삭제 감사 리포트 다운로드 중 오류가 발생했습니다.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `approval-retention-audits-${todayDate()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "보존삭제 감사 리포트 다운로드 중 오류가 발생했습니다.");
    }
  }

  async function loadApprovalBoxes() {
    try {
      const boxes = await api<ApprovalBoxApi[]>("/approvals/boxes");
      const next = boxes
        .filter((item): item is ApprovalBoxApi & { code: ApprovalBox } => isApprovalBox(item.code))
        .map((item) => ({ box: item.code, label: item.label }));
      if (next.length) setApprovalBoxes(next);
    } catch {
      setApprovalBoxes(APPROVAL_BOXES);
    }
  }

  async function loadEmployees() {
    const firstPage = await api<PageResponse<Employee>>("/emps?size=100&page=0&status=ACTIVE");
    const allEmployees = [...firstPage.content];
    for (let pageIndex = 1; pageIndex < firstPage.totalPages; pageIndex += 1) {
      const nextPage = await api<PageResponse<Employee>>(`/emps?size=100&page=${pageIndex}&status=ACTIVE`);
      allEmployees.push(...nextPage.content);
    }
    setEmployees(allEmployees);
  }

  async function loadLeaveUsage(year?: number) {
    try {
      const usage = await api<LeaveUsage>(`/approvals/leave-usage/me${year ? `?year=${year}` : ""}`);
      setLeaveUsage(usage);
      return usage;
    } catch {
      setLeaveUsage(null);
      return null;
    }
  }

  async function changeLeaveBalanceYear(year: number) {
    if (!Number.isInteger(year) || year < 1900 || year > 2100 || leaveUsage?.balanceYear === year) return;
    const usage = await loadLeaveUsage(year);
    if (!usage) return;
    setForm((current) => isLeaveCancelTemplateCode(current.templateCode)
      ? { ...current, fieldValues: { ...current.fieldValues, ...leaveUsageFieldValues(usage) } }
      : current
    );
  }

  async function loadCompTimeSummary() {
    try {
      const summary = await api<CompTimeSummary>("/comp-time/me");
      setCompTimeSummary(summary);
      return summary;
    } catch {
      setCompTimeSummary(null);
      return null;
    }
  }

  async function loadHolidays() {
    try {
      setHolidays(await api<ApprovalHoliday[]>("/approval-holidays"));
    } catch {
      setHolidays([]);
    }
  }

  async function loadLeavePolicies() {
    try {
      const policies = await api<{ leaveType: string }[]>("/leave-policies");
      setLeaveTypeOptions(policies.length ? selectableLeaveTypeOptions(policies.map((policy) => policy.leaveType)) : LEAVE_TYPE_OPTIONS);
    } catch {
      setLeaveTypeOptions(LEAVE_TYPE_OPTIONS);
    }
  }

  async function loadActiveTemplates() {
    let nextTemplates: ApprovalTemplateOption[] = [];
    try {
      const items = await api<ApprovalTemplateApi[]>("/approval-templates");
      nextTemplates = items.map(templateOptionFromApi);
    } catch {
      nextTemplates = [];
    }
    const shouldFallback = !nextTemplates.length && ENABLE_TEMPLATE_FALLBACK;
    const merged = withLeaveCancelTemplate(nextTemplates.length ? nextTemplates : shouldFallback ? DEFAULT_APPROVAL_TEMPLATES : []);
    setTemplateFallbackActive(shouldFallback);
    setTemplates(merged);
    if (merged.length) setPreviewTemplate(firstSelectableApprovalTemplate(merged));
    setForm((current) => current.templateCode ? current : defaultApprovalForm([firstSelectableApprovalTemplate(merged)]));
    return merged;
  }

  async function loadAdminTemplates(preferredCode?: string) {
    if (!isApprovalAdmin) return [];
    const items = await api<ApprovalTemplateApi[]>("/approval-templates/manage");
    const nextTemplates = items.map(templateOptionFromApi);
    setAdminTemplates(nextTemplates);
    if (nextTemplates.length) {
      const selectedCode = preferredCode ?? templateAdminForm.templateCode;
      const selectedTemplate = nextTemplates.find((template) => template.code === selectedCode) ?? nextTemplates[0];
      setTemplateAdminForm(templateAdminFormFromOption(selectedTemplate));
      setTemplateLineForm(defaultApprovalForm([selectedTemplate]));
      void loadTemplateDefaultLine(selectedTemplate.code);
    }
    return nextTemplates;
  }

  async function loadTemplateDefaultLine(templateCode: string) {
    if (!templateCode) return;
    try {
      const defaultLine = await api<ApprovalDefaultLineApi>(`/approval-default-lines/templates/${encodeURIComponent(templateCode)}`);
      setTemplateLineForm((current) => ({
        ...current,
        templateCode,
        agreementEmpIds: defaultLineIds(defaultLine.steps, "AGREEMENT"),
        approverEmpIds: defaultLineIds(defaultLine.steps, "APPROVAL"),
        receiverEmpIds: defaultLineIds(defaultLine.steps, "RECEIVER"),
        referenceEmpIds: defaultLineIds(defaultLine.steps, "REFERENCE"),
        readerEmpIds: defaultLineIds(defaultLine.steps, "READER")
      }));
    } catch {
      setTemplateLineForm((current) => ({
        ...current,
        templateCode,
        agreementEmpIds: [],
        approverEmpIds: [],
        receiverEmpIds: [],
        referenceEmpIds: [],
        readerEmpIds: []
      }));
    }
  }

  async function applyDefaultLine(templateCode: string) {
    const requestId = ++defaultLineRequestId.current;
    const isEquipmentProposal = isEquipmentProposalTemplateCode(templateCode);
    const isLeaveRequest = isLeaveTemplateCode(templateCode);
    const isLeaveCancel = isLeaveCancelTemplateCode(templateCode);
    const isLeaveFlow = isLeaveRequest || isLeaveCancel;
    const isPurchaseRequest = isPurchaseTemplateCode(templateCode);
    const isTrainingRequest = isTrainingRequestTemplateCode(templateCode);
    const isHrDefaultReceiverTemplate = isHrDefaultReceiverTemplateCode(templateCode);
    const equipmentReceiverEmpId = equipmentProposalReceiverId(user, employees);
    const equipmentReceiverMessage = isProductionEngineeringRequester(user, employees)
      ? equipmentReceiverEmpId ? "생산기술 자체 요청은 통합 결재 후 구매팀 김재근 대리에게 전달됩니다." : "구매팀 김재근 대리 계정을 찾지 못했습니다. 구매부서 계정을 확인해 주세요."
      : equipmentReceiverEmpId ? "수신자는 생산기술팀장으로 자동 지정됩니다." : "생산기술팀장을 찾지 못했습니다. 관리자에게 생산기술팀장 계정을 확인해 주세요.";
    const purchaseReceiverEmpId = purchaseRequestReceiverId(employees);
    const hrReceiverEmpId = hrReceiverId(employees);
    const leaveReceiverEmpId = leaveReceiverId(employees, operationSettings?.leaveDefaultReceiverEmpId);
    try {
      const defaultLine = await api<ApprovalDefaultLineApi>(`/approval-default-lines/effective?templateCode=${encodeURIComponent(templateCode)}`);
      if (requestId !== defaultLineRequestId.current) return;
      if (!defaultLine.steps.length) {
        if (isLeaveFlow) {
          setForm((current) => current.templateCode !== templateCode ? current : ({ ...current, receiverEmpIds: leaveReceiverEmpId ? [leaveReceiverEmpId] : [] }));
          setDefaultLineMessage(leaveReceiverEmpId ? "" : "휴가 기본 수신자 설정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
          return;
        }
        if (isPurchaseRequest) {
          setForm((current) => current.templateCode !== templateCode ? current : ({ ...current, receiverEmpIds: purchaseReceiverEmpId ? [purchaseReceiverEmpId] : [] }));
          setDefaultLineMessage(purchaseReceiverEmpId ? "구매요구서 수신자는 김재근 대리로 자동 지정됩니다." : "구매팀 김재근 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
          return;
        }
        if (isHrDefaultReceiverTemplate) {
          setForm((current) => current.templateCode !== templateCode ? current : ({ ...current, receiverEmpIds: hrReceiverEmpId ? [hrReceiverEmpId] : [] }));
          setDefaultLineMessage(hrReceiverEmpId ? "문서의 기본 수신자는 인사총무 허인성 대리입니다." : "인사총무 허인성 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
          return;
        }
        if (isEquipmentProposal) {
          setForm((current) => current.templateCode !== templateCode ? current : ({ ...current, receiverEmpIds: equipmentReceiverEmpId ? [equipmentReceiverEmpId] : [] }));
          setDefaultLineMessage(equipmentReceiverMessage);
          return;
        }
        setDefaultLineMessage("");
        return;
      }
      setForm((current) => {
        if (current.templateCode !== templateCode) return current;
        // Only a template-specific default may supply receivers; personal lines are reusable.
        const documentReceiverIds = defaultLine.source === "TEMPLATE"
          ? defaultLineIds(defaultLine.steps, "RECEIVER")
          : current.receiverEmpIds;
        return {
          ...current,
          agreementEmpIds: defaultLineIds(defaultLine.steps, "AGREEMENT"),
          approverEmpIds: defaultLineIds(defaultLine.steps, "APPROVAL"),
          receiverEmpIds: isLeaveFlow ? (leaveReceiverEmpId ? [leaveReceiverEmpId] : documentReceiverIds.slice(0, 1)) : isPurchaseRequest ? (purchaseReceiverEmpId ? [purchaseReceiverEmpId] : documentReceiverIds) : isHrDefaultReceiverTemplate ? (hrReceiverEmpId ? [hrReceiverEmpId] : documentReceiverIds.slice(0, 1)) : isEquipmentProposal ? (equipmentReceiverEmpId ? [equipmentReceiverEmpId] : []) : documentReceiverIds,
          referenceEmpIds: defaultLineIds(defaultLine.steps, "REFERENCE"),
          readerEmpIds: defaultLineIds(defaultLine.steps, "READER")
        };
      });
      setDefaultLineMessage(isLeaveFlow
        ? leaveReceiverEmpId ? "" : "휴가 기본 수신자 설정을 찾지 못했습니다. 수신자를 직접 지정해 주세요."
        : isPurchaseRequest
        ? purchaseReceiverEmpId ? "구매요구서 수신자는 김재근 대리로 자동 지정됩니다." : "구매팀 김재근 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요."
        : isHrDefaultReceiverTemplate
        ? hrReceiverEmpId ? "문서의 기본 수신자는 인사총무 허인성 대리입니다." : "인사총무 허인성 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요."
        : isEquipmentProposal
        ? equipmentReceiverMessage
        : defaultLine.source === "TEMPLATE" ? "양식별 기본 결재선을 적용했습니다." : "개인 기본 결재선을 적용했습니다.");
    } catch {
      if (requestId !== defaultLineRequestId.current) return;
      if (isLeaveFlow) {
        setForm((current) => current.templateCode !== templateCode ? current : ({ ...current, receiverEmpIds: leaveReceiverEmpId ? [leaveReceiverEmpId] : [] }));
        setDefaultLineMessage(leaveReceiverEmpId ? "" : "휴가 기본 수신자 설정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
        return;
      }
      if (isPurchaseRequest) {
        setForm((current) => current.templateCode !== templateCode ? current : ({ ...current, receiverEmpIds: purchaseReceiverEmpId ? [purchaseReceiverEmpId] : [] }));
        setDefaultLineMessage(purchaseReceiverEmpId ? "구매요구서 수신자는 김재근 대리로 자동 지정됩니다." : "구매팀 김재근 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
        return;
      }
      if (isHrDefaultReceiverTemplate) {
        setForm((current) => current.templateCode !== templateCode ? current : ({ ...current, receiverEmpIds: hrReceiverEmpId ? [hrReceiverEmpId] : [] }));
        setDefaultLineMessage(hrReceiverEmpId ? "문서의 기본 수신자는 인사총무 허인성 대리입니다." : "인사총무 허인성 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
        return;
      }
      if (isEquipmentProposal) {
        setForm((current) => current.templateCode !== templateCode ? current : ({ ...current, receiverEmpIds: equipmentReceiverEmpId ? [equipmentReceiverEmpId] : [] }));
        setDefaultLineMessage(equipmentReceiverMessage);
        return;
      }
      setDefaultLineMessage("");
    }
  }

  async function rememberSubmittedApprovalLine(submittedForm: ApprovalForm) {
    if (!submittedForm.approverEmpIds.length) return;
    try {
      await api<ApprovalDefaultLineApi>("/approval-default-lines/me", {
        method: "PUT",
        body: jsonBody(defaultLinePayload(submittedForm, "최근 사용 결재선", false))
      });
    } catch {
      // Recent-line persistence is a convenience; document submission already succeeded.
    }
  }

  function selectAdminTemplate(template: ApprovalTemplateOption) {
    setTemplateAdminForm(templateAdminFormFromOption(template));
    setTemplateLineForm(defaultApprovalForm([template]));
    setTemplateAdminMessage("");
    setApprovalError("");
    void loadTemplateDefaultLine(template.code);
  }

  function newAdminTemplate() {
    setTemplateAdminForm(templateAdminFormFromOption());
    setTemplateLineForm(defaultApprovalForm(templates));
    setTemplateAdminMessage("");
    setApprovalError("");
  }

  async function saveTemplateVersion() {
    setApprovalError("");
    setTemplateAdminMessage("");
    if (!templateAdminForm.templateCode.trim() || !templateAdminForm.templateName.trim()) {
      setApprovalError("양식 코드와 양식명을 입력해 주세요.");
      return;
    }
    try {
      const saved = await api<ApprovalTemplateApi>("/approval-templates", {
        method: "POST",
        body: jsonBody({
          templateCode: templateAdminForm.templateCode,
          templateName: templateAdminForm.templateName,
          description: templateAdminForm.description,
          fieldsJson: templateAdminForm.fieldsJson,
          printLayoutJson: templateAdminForm.printLayoutJson,
          sortOrder: templateAdminForm.sortOrder,
          active: templateAdminForm.active
        })
      });
      const savedOption = templateOptionFromApi(saved);
      setTemplateAdminForm(templateAdminFormFromOption(savedOption));
      setTemplateLineForm(defaultApprovalForm([savedOption]));
      await loadActiveTemplates();
      await loadAdminTemplates(saved.templateCode);
      setTemplateAdminMessage(`${saved.templateName} v${saved.version} 저장 완료`);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "양식 저장 중 오류가 발생했습니다.");
    }
  }

  async function toggleTemplateActive(template: ApprovalTemplateOption, active: boolean) {
    setApprovalError("");
    setTemplateAdminMessage("");
    const previousActive = template.activeYn !== "N";
    setTemplateStatusUpdating(true);
    setTemplateAdminForm((current) => current.templateCode === template.code ? { ...current, active } : current);
    try {
      const saved = await api<ApprovalTemplateApi>(`/approval-templates/${encodeURIComponent(template.code)}/status?active=${active}`, { method: "PATCH" });
      const savedOption = templateOptionFromApi(saved);
      setTemplateAdminForm(templateAdminFormFromOption(savedOption));
      await loadActiveTemplates();
      await loadAdminTemplates(saved.templateCode);
      setTemplateAdminMessage(active ? "양식을 활성화했습니다." : "양식을 비활성화했습니다.");
    } catch (err) {
      setTemplateAdminForm((current) => current.templateCode === template.code ? { ...current, active: previousActive } : current);
      setApprovalError(err instanceof Error ? err.message : "양식 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setTemplateStatusUpdating(false);
    }
  }

  async function saveTemplateDefaultLine() {
    setApprovalError("");
    setTemplateAdminMessage("");
    if (!templateAdminForm.templateCode.trim()) {
      setApprovalError("먼저 양식을 선택하거나 저장해 주세요.");
      return;
    }
    if (!templateLineForm.approverEmpIds.length) {
      setApprovalError("양식별 기본 결재선에는 결재자를 1명 이상 포함해야 합니다.");
      return;
    }
    try {
      await api<ApprovalDefaultLineApi>(`/approval-default-lines/templates/${encodeURIComponent(templateAdminForm.templateCode)}`, {
        method: "PUT",
        body: jsonBody(defaultLinePayload(templateLineForm, `${templateAdminForm.templateName || templateAdminForm.templateCode} 기본 결재선`))
      });
      setTemplateAdminMessage("양식별 기본 결재선을 저장했습니다.");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "양식별 기본 결재선 저장 중 오류가 발생했습니다.");
    }
  }

  async function loadDelegation() {
    try {
      const current = await api<ApprovalDelegationApi | null>("/approval-delegations/me");
      setDelegation(current);
      setDelegationForm(current ? {
        delegateEmpId: current.delegateEmpId,
        startDate: current.startDate,
        endDate: current.endDate ?? "",
        reason: current.reason ?? "",
        active: current.activeYn === "Y"
      } : defaultDelegationForm());
      setDelegationMessage("");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "대리결재 설정 조회 중 오류가 발생했습니다.");
    }
  }

  async function openDelegationSettings() {
    setApprovalError("");
    setApprovalCategory("active");
    setDashboardFilter(null);
    setSelected(null);
    setMode("delegation");
    await loadDelegation();
  }

  async function saveDelegation() {
    setApprovalError("");
    setDelegationMessage("");
    if (!delegationForm.delegateEmpId) {
      setApprovalError("대리자를 선택해 주세요.");
      return;
    }
    try {
      const saved = await api<ApprovalDelegationApi>("/approval-delegations/me", {
        method: "PUT",
        body: jsonBody({
          delegateEmpId: delegationForm.delegateEmpId,
          startDate: delegationForm.startDate,
          endDate: delegationForm.endDate || null,
          reason: delegationForm.reason,
          active: delegationForm.active
        })
      });
      setDelegation(saved);
      setDelegationForm({
        delegateEmpId: saved.delegateEmpId,
        startDate: saved.startDate,
        endDate: saved.endDate ?? "",
        reason: saved.reason ?? "",
        active: saved.activeYn === "Y"
      });
      setDelegationMessage("대리결재 설정을 저장했습니다.");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "대리결재 설정 저장 중 오류가 발생했습니다.");
    }
  }

  async function deleteDelegation() {
    setApprovalError("");
    setDelegationMessage("");
    try {
      await api<void>("/approval-delegations/me", { method: "DELETE" });
      setDelegation(null);
      setDelegationForm(defaultDelegationForm());
      setDelegationMessage("대리결재 설정을 해제했습니다.");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "대리결재 설정 해제 중 오류가 발생했습니다.");
    }
  }

  async function loadDetail(id: number) {
    try {
      const detail = await api<Approval>(`/approvals/${id}`);
      if (isEquipmentProposalTemplateCode(detail.templateCode)) {
        setEquipmentProposalLoading(true);
        const proposal = await api<EquipmentProposal>(`/approvals/${id}/equipment-proposal`);
        setEquipmentProposal(proposal);
      } else {
        setEquipmentProposal(null);
      }
      const completionReportId = equipmentCompletionReportId(detail);
      setEquipmentCompletionReport(completionReportId ? await api<EquipmentReport>(`/equipment/reports/${completionReportId}`) : null);
      if (isLeaveTemplateCode(detail.templateCode) || isLeaveCancelTemplateCode(detail.templateCode)) {
        try {
          setLeaveExclusions(await api<LeaveExclusion[]>(`/approval-holidays/approvals/${id}/exclusions`));
        } catch {
          setLeaveExclusions([]);
        }
      } else {
        setLeaveExclusions([]);
      }
      setSelected(detail);
      setMode("detail");
      setApprovalError("");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "문서 조회 권한이 없습니다.");
    } finally {
      setEquipmentProposalLoading(false);
    }
  }

  async function refreshEquipmentProposal(approval: Approval | null = selected) {
    if (approval && isEquipmentProposalTemplateCode(approval.templateCode)) {
      setEquipmentProposalLoading(true);
      try {
        setEquipmentProposal(await api<EquipmentProposal>(`/approvals/${approval.approvalId}/equipment-proposal`));
      } finally {
        setEquipmentProposalLoading(false);
      }
    } else {
      setEquipmentProposal(null);
      setEquipmentProposalLoading(false);
    }
  }

  async function loadOperationSettings() {
    setApprovalError("");
    try {
      const settings = await api<ApprovalOperationSettings>("/approval-operation-settings");
      setOperationSettings(settings);
      setOperationSettingsForm({
        decisionDueHours: settings.decisionDueHours,
        reminderFixedDelayMs: settings.reminderFixedDelayMs,
        deletedDocumentRetentionDays: settings.deletedDocumentRetentionDays,
        permanentDeleteEnabled: settings.permanentDeleteEnabled,
        leaveDefaultReceiverEmpId: settings.leaveDefaultReceiverEmpId
      });
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "운영 설정 조회 중 오류가 발생했습니다.");
    }
  }

  function openOperationSettings() {
    setMode("operationSettings");
    setDashboardFilter(null);
    setSelected(null);
    setApprovalError("");
    setOperationSettingsMessage("");
    void loadOperationSettings();
  }

  function openHolidayManagement() {
    setMode("holidays");
    setDashboardFilter(null);
    setSelected(null);
    setApprovalError("");
  }

  async function openDeletedApprovals() {
    setApprovalError("");
    setDashboardFilter(null);
    setSelected(null);
    setMode("deleted");
    setItems([]);
    void loadOperationSettings();
    void loadRetentionAudits();
    await loadDeletedApprovals();
  }

  async function restoreApproval(approvalId: number) {
    const comment = window.prompt("복구 사유", "보존삭제 문서 복구") ?? "";
    try {
      await api<Approval>(`/approvals/${approvalId}/restore`, {
        method: "POST",
        body: jsonBody({ comment })
      });
      setApprovalError("");
      await loadDeletedApprovals();
      await loadRetentionAudits();
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "문서 복구 중 오류가 발생했습니다.");
    }
  }

  async function saveOperationSettings() {
    setApprovalError("");
    setOperationSettingsMessage("");
    if (operationSettingsForm.decisionDueHours < 1 || operationSettingsForm.decisionDueHours > 720) {
      setApprovalError("처리 기한은 1시간 이상 720시간 이하로 입력해 주세요.");
      return;
    }
    if (operationSettingsForm.reminderFixedDelayMs < 60000 || operationSettingsForm.reminderFixedDelayMs > 86400000) {
      setApprovalError("지연 알림 간격은 60,000ms 이상 86,400,000ms 이하로 입력해 주세요.");
      return;
    }
    if (operationSettingsForm.deletedDocumentRetentionDays < 30 || operationSettingsForm.deletedDocumentRetentionDays > 3650) {
      setApprovalError("보존삭제 문서 보관일수는 30일 이상 3650일 이하로 입력해 주세요.");
      return;
    }
    if (!operationSettingsForm.leaveDefaultReceiverEmpId) {
      setApprovalError("휴가 기본 수신자를 선택해 주세요.");
      return;
    }
    try {
      const saved = await api<ApprovalOperationSettings>("/approval-operation-settings", {
        method: "PUT",
        body: jsonBody(operationSettingsForm)
      });
      setOperationSettings(saved);
      setOperationSettingsForm({
        decisionDueHours: saved.decisionDueHours,
        reminderFixedDelayMs: saved.reminderFixedDelayMs,
        deletedDocumentRetentionDays: saved.deletedDocumentRetentionDays,
        permanentDeleteEnabled: saved.permanentDeleteEnabled,
        leaveDefaultReceiverEmpId: saved.leaveDefaultReceiverEmpId
      });
      setOperationSettingsMessage("전자결재 운영 설정을 저장했습니다.");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "운영 설정 저장 중 오류가 발생했습니다.");
    }
  }

  useEffect(() => {
    setItems([]);
    void load(box);
  }, [box]);

  useEffect(() => {
    if (!launch) {
      setDashboardFilter(null);
      return;
    }
    setDashboardFilter(launch);
    setApprovalCategory("active");
    setBox(launch.box);
    setSelected(null);
    setMode("list");
    setItems([]);
    void load(launch.box, launch.dashboardFilter);
  }, [launch]);

  useEffect(() => {
    if (target?.type === "APPROVAL") {
      setDashboardFilter(null);
      setApprovalCategory("active");
      setBox("requested");
      setItems([]);
      void loadDetail(target.targetId);
    }
  }, [target?.nonce]);

  useEffect(() => {
    void loadEmployees();
    void loadApprovalBoxes();
    void loadActiveTemplates().catch(() => undefined);
    void approvalLineLibrary.loadSavedApprovalLines();
    void loadHolidays();
    void loadLeavePolicies();
    void loadCompTimeSummary();
    void loadOperationSettings();
  }, []);

  useEffect(() => {
    if (mode !== "create" || (!isLeaveTemplateCode(form.templateCode) && !isLeaveCancelTemplateCode(form.templateCode))) return;
    const receiverEmpId = leaveReceiverId(employees, operationSettings?.leaveDefaultReceiverEmpId);
    if (!receiverEmpId) return;
    setForm((current) => current.receiverEmpIds.length ? current : { ...current, receiverEmpIds: [receiverEmpId] });
  }, [employees, form.templateCode, mode, operationSettings?.leaveDefaultReceiverEmpId]);

  useEffect(() => {
    setApprovalActionComment("");
  }, [selected?.approvalId]);

  async function changeBox(nextBox: ApprovalBox) {
    setApprovalError("");
    setDashboardFilter(null);
    setBox(nextBox);
    setSelected(null);
    setMode("list");
    setItems([]);
    await load(nextBox, null, null);
  }

  async function openApprovalWorkView(view: { box: ApprovalBox; label: string; dashboardFilter?: ApprovalDashboardFilter }) {
    setApprovalError("");
    setApprovalCategory("active");
    const nextFilter = view.dashboardFilter ? { box: view.box, dashboardFilter: view.dashboardFilter, label: view.label } : null;
    setDashboardFilter(nextFilter);
    setBox(view.box);
    setSelected(null);
    setMode("list");
    setItems([]);
    await load(view.box, view.dashboardFilter ?? null, null);
  }

  async function applyApprovalSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await applyApprovalSearchValues(approvalSearch);
  }

  async function applyApprovalSearchValues(search: ApprovalSearchForm) {
    setApprovalError("");
    const nextFilter = approvalCategory === "completed" ? { box: "processed" as ApprovalBox, dashboardFilter: "completedInvolved" as ApprovalDashboardFilter, label: "결재 완료문서" } : null;
    setAppliedApprovalSearchScope(approvalSearchScope(search));
    setDashboardFilter(nextFilter);
    setSelected(null);
    setMode("list");
    setItems([]);
    await load(approvalCategory === "completed" ? "processed" : box, nextFilter?.dashboardFilter ?? null, search);
  }

  async function changeApprovalCategory(nextCategory: ApprovalCategory) {
    setApprovalError("");
    setApprovalCategory(nextCategory);
    setSelected(null);
    setMode("list");
    setItems([]);
    if (nextCategory === "completed") {
      const nextFilter = { box: "processed" as ApprovalBox, dashboardFilter: "completedInvolved" as ApprovalDashboardFilter, label: "결재 완료문서" };
      setAppliedApprovalSearchScope(approvalSearchScope(approvalSearch));
      setDashboardFilter(nextFilter);
      setBox("processed");
      await load("processed", "completedInvolved", approvalSearch);
      return;
    }
    const nextFilter = { box: "pending" as ApprovalBox, dashboardFilter: "actionRequired" as ApprovalDashboardFilter, label: "결재할 문서" };
    setDashboardFilter(nextFilter);
    setBox("pending");
    await load("pending", "actionRequired", null);
  }

  async function resetApprovalSearch() {
    const nextSearch = DEFAULT_APPROVAL_SEARCH;
    setApprovalSearch(nextSearch);
    await applyApprovalSearchValues(nextSearch);
  }

  async function updateApprovalSearchFilter(nextSearch: ApprovalSearchForm) {
    setApprovalSearch(nextSearch);
    await applyApprovalSearchValues(nextSearch);
  }

  async function openTemplateAdmin() {
    setApprovalError("");
    setDashboardFilter(null);
    setSelected(null);
    setMode("templates");
    await loadAdminTemplates();
  }

  return {
    box, setBox, dashboardFilter, setDashboardFilter, approvalCategory, setApprovalCategory, items, setItems, listLoading, listError,
    retentionAudits, setRetentionAudits, approvalBoxes, setApprovalBoxes, selected, setSelected, equipmentProposal, setEquipmentProposal,
    equipmentProposalLoading, setEquipmentProposalLoading, equipmentCompletionReport, setEquipmentCompletionReport, mode, setMode, templates, setTemplates,
    adminTemplates, setAdminTemplates, templateFallbackActive, setTemplateFallbackActive, templateModalOpen, setTemplateModalOpen, previewTemplate, setPreviewTemplate,
    form, setForm, leaveUsage, setLeaveUsage, compTimeSummary, setCompTimeSummary, holidays, setHolidays,
    leaveTypeOptions, setLeaveTypeOptions, leaveExclusions, setLeaveExclusions, leavePreviewOpen, setLeavePreviewOpen, templateAdminForm, setTemplateAdminForm,
    templateLineForm, setTemplateLineForm, pendingFiles, setPendingFiles, employees, setEmployees, approvalError, setApprovalError,
    defaultLineMessage, setDefaultLineMessage, approvalLineLibrary, approvalInfoOpen, setApprovalInfoOpen,
    templateAdminMessage, setTemplateAdminMessage, templateStatusUpdating, delegation, setDelegation, delegationForm, setDelegationForm, delegationMessage, setDelegationMessage,
    operationSettingsForm, setOperationSettingsForm, operationSettings, setOperationSettings, operationSettingsMessage, setOperationSettingsMessage, approvalActionComment, setApprovalActionComment,
    approvalSearch, setApprovalSearch, appliedApprovalSearchScope, isApprovalAdmin, isHolidayManager, isLeavePolicyManager, canViewPreview, visibleTemplates, load,
    loadDeletedApprovals, loadRetentionAudits, downloadRetentionAuditCsv, loadApprovalBoxes, loadEmployees, loadLeaveUsage, changeLeaveBalanceYear, loadCompTimeSummary,
    loadHolidays, loadLeavePolicies, loadActiveTemplates, loadAdminTemplates, loadTemplateDefaultLine, applyDefaultLine,
    rememberSubmittedApprovalLine, selectAdminTemplate, newAdminTemplate, saveTemplateVersion,
    toggleTemplateActive, saveTemplateDefaultLine, loadDelegation, openDelegationSettings, saveDelegation, deleteDelegation, loadDetail, refreshEquipmentProposal,
    loadOperationSettings, openOperationSettings, openHolidayManagement, openDeletedApprovals, restoreApproval, saveOperationSettings, changeBox, openApprovalWorkView,
    applyApprovalSearch, applyApprovalSearchValues, changeApprovalCategory, resetApprovalSearch, updateApprovalSearchFilter, openTemplateAdmin
  };
}
