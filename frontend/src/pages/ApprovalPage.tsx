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
  LeaveUsage,
  PageResponse,
  User
} from "../types";
import { ClassicDraftEditor, downloadApprovalPdf } from "./ApprovalClassicParts";
import { ApprovalDetailView } from "./ApprovalParts";
import { EquipmentProposalEditor, equipmentProposalContent, LeaveRequestEditor, PurchaseRequestEditor, TemplateFieldInputs, TrainingReportEditor, TrainingRequestEditor } from "./ApprovalFormParts";
import { APPROVAL_BOXES, isApprovalBox, TemplateSelectModalV2 } from "./ApprovalTemplateParts";
export function ApprovalPage({ user, launch, target }: { user: User; launch: ApprovalLaunch | null; target: GlobalSearchTarget | null }) {
  const [box, setBox] = useState<ApprovalBox>(launch?.box ?? "pending");
  const [dashboardFilter, setDashboardFilter] = useState<ApprovalLaunch | null>(launch);
  const [approvalCategory, setApprovalCategory] = useState<ApprovalCategory>("active");
  const [items, setItems] = useState<ApprovalSummary[]>([]);
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
  const [templateAdminForm, setTemplateAdminForm] = useState<ApprovalTemplateAdminForm>(() => templateAdminFormFromOption());
  const [templateLineForm, setTemplateLineForm] = useState<ApprovalForm>(() => defaultApprovalForm());
  const [pendingFiles, setPendingFiles] = useState<DraftAttachment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [approvalError, setApprovalError] = useState("");
  const [defaultLineMessage, setDefaultLineMessage] = useState("");
  const [savedApprovalLines, setSavedApprovalLines] = useState<ApprovalDefaultLineApi[]>([]);
  const [selectedSavedLineId, setSelectedSavedLineId] = useState("");
  const [templateAdminMessage, setTemplateAdminMessage] = useState("");
  const [delegation, setDelegation] = useState<ApprovalDelegationApi | null>(null);
  const [delegationForm, setDelegationForm] = useState<ApprovalDelegationForm>(() => defaultDelegationForm());
  const [delegationMessage, setDelegationMessage] = useState("");
  const [operationSettingsForm, setOperationSettingsForm] = useState<ApprovalOperationSettingsForm>(() => defaultOperationSettingsForm());
  const [operationSettings, setOperationSettings] = useState<ApprovalOperationSettings | null>(null);
  const [operationSettingsMessage, setOperationSettingsMessage] = useState("");
  const [approvalActionComment, setApprovalActionComment] = useState("");
  const [approvalSearch, setApprovalSearch] = useState<ApprovalSearchForm>(DEFAULT_APPROVAL_SEARCH);
  const isApprovalAdmin = user.roleCode === "ADMIN" || user.roleCode === "APPROVAL_ADMIN";

  async function load(
    targetBox: ApprovalBox,
    targetFilter: ApprovalDashboardFilter | null | undefined = dashboardFilter?.dashboardFilter,
    search: ApprovalSearchForm = approvalSearch
  ) {
    const params = new URLSearchParams({ box: targetBox, size: "30" });
    if (targetFilter) params.set("dashboardFilter", targetFilter);
    Object.entries(search).forEach(([key, value]) => {
      const trimmed = value.trim();
      if (trimmed) params.set(key, trimmed);
    });
    const page = await api<PageResponse<ApprovalSummary>>(`/approvals?${params.toString()}`);
    setItems(page.content);
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
    const page = await api<PageResponse<Employee>>("/emps?size=100&status=ACTIVE");
    setEmployees(page.content);
  }

  async function loadLeaveUsage() {
    try {
      const usage = await api<LeaveUsage>("/approvals/leave-usage/me");
      setLeaveUsage(usage);
      return usage;
    } catch {
      setLeaveUsage(null);
      return null;
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

  async function loadSavedApprovalLines() {
    try {
      const lines = await api<ApprovalDefaultLineApi[]>("/approval-default-lines/me");
      setSavedApprovalLines(lines);
      setSelectedSavedLineId((current) => current && lines.some((line) => String(line.defaultLineId) === current) ? current : (lines[0]?.defaultLineId ? String(lines[0].defaultLineId) : ""));
    } catch {
      setSavedApprovalLines([]);
      setSelectedSavedLineId("");
    }
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
    const isEquipmentProposal = isEquipmentProposalTemplateCode(templateCode);
    const isLeaveRequest = isLeaveTemplateCode(templateCode);
    const isPurchaseRequest = isPurchaseTemplateCode(templateCode);
    const isTrainingRequest = isTrainingRequestTemplateCode(templateCode);
    const isTrainingTemplate = isTrainingTemplateCode(templateCode);
    const peManagerId = productionEngineeringManagerId(employees);
    const purchaseReceiverEmpId = purchaseReceiverId(employees);
    const trainingReceiverEmpId = trainingReceiverId(employees);
    const leaveReceiverEmpId = leaveReceiverId(employees);
    try {
      const defaultLine = await api<ApprovalDefaultLineApi>(`/approval-default-lines/effective?templateCode=${encodeURIComponent(templateCode)}`);
      if (!defaultLine.steps.length) {
        if (isLeaveRequest) {
          setForm((current) => ({ ...current, receiverEmpIds: leaveReceiverEmpId ? [leaveReceiverEmpId] : [] }));
          setDefaultLineMessage(leaveReceiverEmpId ? "휴가계 수신자는 인사총무 허인성 대리로 자동 지정됩니다." : "인사총무 허인성 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
          return;
        }
        if (isPurchaseRequest) {
          setForm((current) => ({ ...current, receiverEmpIds: purchaseReceiverEmpId ? [purchaseReceiverEmpId] : [] }));
          setDefaultLineMessage(purchaseReceiverEmpId ? "구매요구서 수신자는 임나영 대리로 자동 지정됩니다." : "구매팀 임나영 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
          return;
        }
        if (isTrainingTemplate) {
          setForm((current) => ({ ...current, receiverEmpIds: trainingReceiverEmpId ? [trainingReceiverEmpId] : [] }));
          setDefaultLineMessage(trainingReceiverEmpId ? "교육 문서 수신자는 인사총무 홍길동으로 자동 지정됩니다." : "인사총무 홍길동 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
          return;
        }
        if (isEquipmentProposal) {
          setForm((current) => ({ ...current, receiverEmpIds: peManagerId ? [peManagerId] : [] }));
          setDefaultLineMessage(peManagerId ? "수신자는 생산기술팀장으로 자동 지정됩니다." : "생산기술팀장을 찾지 못했습니다. 관리자에게 생산기술팀장 계정을 확인해 주세요.");
          return;
        }
        setDefaultLineMessage("");
        return;
      }
      setForm((current) => {
        return {
          ...current,
          agreementEmpIds: defaultLineIds(defaultLine.steps, "AGREEMENT"),
          approverEmpIds: defaultLineIds(defaultLine.steps, "APPROVAL"),
          receiverEmpIds: isLeaveRequest ? (leaveReceiverEmpId ? [leaveReceiverEmpId] : defaultLineIds(defaultLine.steps, "RECEIVER").slice(0, 1)) : isPurchaseRequest ? (purchaseReceiverEmpId ? [purchaseReceiverEmpId] : defaultLineIds(defaultLine.steps, "RECEIVER")) : isTrainingTemplate ? (trainingReceiverEmpId ? [trainingReceiverEmpId] : defaultLineIds(defaultLine.steps, "RECEIVER").slice(0, 1)) : isEquipmentProposal ? (peManagerId ? [peManagerId] : []) : defaultLineIds(defaultLine.steps, "RECEIVER"),
          referenceEmpIds: defaultLineIds(defaultLine.steps, "REFERENCE"),
          readerEmpIds: defaultLineIds(defaultLine.steps, "READER")
        };
      });
      setDefaultLineMessage(isLeaveRequest
        ? leaveReceiverEmpId ? "휴가계 수신자는 인사총무 허인성 대리로 자동 지정됩니다." : "인사총무 허인성 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요."
        : isPurchaseRequest
        ? purchaseReceiverEmpId ? "구매요구서 수신자는 임나영 대리로 자동 지정됩니다." : "구매팀 임나영 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요."
        : isTrainingTemplate
        ? trainingReceiverEmpId ? "교육 문서 수신자는 인사총무 홍길동으로 자동 지정됩니다." : "인사총무 홍길동 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요."
        : isEquipmentProposal
        ? peManagerId ? "수신자는 생산기술팀장으로 자동 지정됩니다." : "생산기술팀장을 찾지 못했습니다. 관리자에게 생산기술팀장 계정을 확인해 주세요."
        : defaultLine.source === "TEMPLATE" ? "양식별 기본 결재선을 적용했습니다." : "개인 기본 결재선을 적용했습니다.");
    } catch {
      if (isLeaveRequest) {
        setForm((current) => ({ ...current, receiverEmpIds: leaveReceiverEmpId ? [leaveReceiverEmpId] : [] }));
        setDefaultLineMessage(leaveReceiverEmpId ? "휴가계 수신자는 인사총무 허인성 대리로 자동 지정됩니다." : "인사총무 허인성 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
        return;
      }
      if (isPurchaseRequest) {
        setForm((current) => ({ ...current, receiverEmpIds: purchaseReceiverEmpId ? [purchaseReceiverEmpId] : [] }));
        setDefaultLineMessage(purchaseReceiverEmpId ? "구매요구서 수신자는 임나영 대리로 자동 지정됩니다." : "구매팀 임나영 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
        return;
      }
      if (isTrainingTemplate) {
        setForm((current) => ({ ...current, receiverEmpIds: trainingReceiverEmpId ? [trainingReceiverEmpId] : [] }));
        setDefaultLineMessage(trainingReceiverEmpId ? "교육 문서 수신자는 인사총무 홍길동으로 자동 지정됩니다." : "인사총무 홍길동 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
        return;
      }
      if (isEquipmentProposal) {
        setForm((current) => ({ ...current, receiverEmpIds: peManagerId ? [peManagerId] : [] }));
        setDefaultLineMessage(peManagerId ? "수신자는 생산기술팀장으로 자동 지정됩니다." : "생산기술팀장을 찾지 못했습니다. 관리자에게 생산기술팀장 계정을 확인해 주세요.");
        return;
      }
      setDefaultLineMessage("");
    }
  }

  async function savePersonalDefaultLine() {
    setApprovalError("");
    if (!form.approverEmpIds.length) {
      setApprovalError("개인 기본 결재선에는 결재자를 1명 이상 포함해야 합니다.");
      return;
    }
    try {
      await api<ApprovalDefaultLineApi>("/approval-default-lines/me", {
        method: "PUT",
        body: jsonBody(defaultLinePayload(form))
      });
      setDefaultLineMessage("개인 기본 결재선을 저장했습니다.");
      await loadSavedApprovalLines();
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "개인 기본 결재선 저장 중 오류가 발생했습니다.");
    }
  }

  async function saveNamedApprovalLine() {
    setApprovalError("");
    if (!form.approverEmpIds.length) {
      setApprovalError("저장할 결재라인에는 결재자를 1명 이상 포함해야 합니다.");
      return;
    }
    const lineName = window.prompt("저장할 결재라인 이름", "팀장 최종 결재") ?? "";
    if (!lineName.trim()) return;
    try {
      const saved = await api<ApprovalDefaultLineApi>("/approval-default-lines/me", {
        method: "PUT",
        body: jsonBody(defaultLinePayload(form, lineName.trim()))
      });
      await loadSavedApprovalLines();
      if (saved.defaultLineId) setSelectedSavedLineId(String(saved.defaultLineId));
      setDefaultLineMessage(`${lineName.trim()} 결재라인을 저장했습니다.`);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "결재라인 저장 중 오류가 발생했습니다.");
    }
  }

  function applySavedApprovalLine() {
    const savedLine = savedApprovalLines.find((line) => String(line.defaultLineId) === selectedSavedLineId);
    if (!savedLine) {
      setApprovalError("불러올 결재라인을 선택해 주세요.");
      return;
    }
    setForm((current) => ({
      ...current,
      agreementEmpIds: defaultLineIds(savedLine.steps, "AGREEMENT"),
      approverEmpIds: defaultLineIds(savedLine.steps, "APPROVAL"),
      receiverEmpIds: defaultLineIds(savedLine.steps, "RECEIVER"),
      referenceEmpIds: defaultLineIds(savedLine.steps, "REFERENCE"),
      readerEmpIds: defaultLineIds(savedLine.steps, "READER")
    }));
    setDefaultLineMessage(`${savedLine.lineName ?? "저장된 결재라인"}을 적용했습니다.`);
  }

  async function renameSavedApprovalLine() {
    const savedLine = savedApprovalLines.find((line) => String(line.defaultLineId) === selectedSavedLineId);
    if (!savedLine?.defaultLineId) {
      setApprovalError("이름을 변경할 결재라인을 선택해 주세요.");
      return;
    }
    const lineName = window.prompt("결재라인 이름 변경", savedLine.lineName ?? "") ?? "";
    if (!lineName.trim()) return;
    try {
      await api<ApprovalDefaultLineApi>(`/approval-default-lines/me/${savedLine.defaultLineId}`, {
        method: "PATCH",
        body: jsonBody({ lineName: lineName.trim() })
      });
      await loadSavedApprovalLines();
      setSelectedSavedLineId(String(savedLine.defaultLineId));
      setDefaultLineMessage(`${lineName.trim()}으로 이름을 변경했습니다.`);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "결재라인 이름 변경 중 오류가 발생했습니다.");
    }
  }

  async function deleteSavedApprovalLine() {
    const savedLine = savedApprovalLines.find((line) => String(line.defaultLineId) === selectedSavedLineId);
    if (!savedLine?.defaultLineId) {
      setApprovalError("삭제할 결재라인을 선택해 주세요.");
      return;
    }
    if (!window.confirm(`${savedLine.lineName ?? "선택한 결재라인"}을 삭제할까요?`)) return;
    try {
      await api<void>(`/approval-default-lines/me/${savedLine.defaultLineId}`, { method: "DELETE" });
      await loadSavedApprovalLines();
      setDefaultLineMessage(`${savedLine.lineName ?? "결재라인"}을 삭제했습니다.`);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "결재라인 삭제 중 오류가 발생했습니다.");
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
    try {
      const saved = await api<ApprovalTemplateApi>(`/approval-templates/${encodeURIComponent(template.code)}/status?active=${active}`, { method: "PATCH" });
      const savedOption = templateOptionFromApi(saved);
      setTemplateAdminForm(templateAdminFormFromOption(savedOption));
      await loadActiveTemplates();
      await loadAdminTemplates(saved.templateCode);
      setTemplateAdminMessage(active ? "양식을 활성화했습니다." : "양식을 비활성화했습니다.");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "양식 상태 변경 중 오류가 발생했습니다.");
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
    if (!isApprovalAdmin) return;
    setApprovalError("");
    try {
      const settings = await api<ApprovalOperationSettings>("/approval-operation-settings");
      setOperationSettings(settings);
      setOperationSettingsForm({
        decisionDueHours: settings.decisionDueHours,
        reminderFixedDelayMs: settings.reminderFixedDelayMs,
        deletedDocumentRetentionDays: settings.deletedDocumentRetentionDays,
        permanentDeleteEnabled: settings.permanentDeleteEnabled
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
        permanentDeleteEnabled: saved.permanentDeleteEnabled
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
    void loadSavedApprovalLines();
  }, []);

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
    await load(nextBox, null);
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
    await load(view.box, view.dashboardFilter ?? null);
  }

  async function applyApprovalSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await applyApprovalSearchValues(approvalSearch);
  }

  async function applyApprovalSearchValues(search: ApprovalSearchForm) {
    setApprovalError("");
    const nextFilter = approvalCategory === "completed" ? { box: "processed" as ApprovalBox, dashboardFilter: "completedInvolved" as ApprovalDashboardFilter, label: "결재 완료문서" } : null;
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
      setDashboardFilter(nextFilter);
      setBox("processed");
      await load("processed", "completedInvolved", approvalSearch);
      return;
    }
    const nextFilter = { box: "pending" as ApprovalBox, dashboardFilter: "actionRequired" as ApprovalDashboardFilter, label: "결재할 문서" };
    setDashboardFilter(nextFilter);
    setBox("pending");
    await load("pending", "actionRequired", approvalSearch);
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

  function startCreate() {
    const selectableTemplates = selectableApprovalTemplates(templates);
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
    const leaveReceiverEmpId = leaveReceiverId(employees);
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
      receiverEmpIds: isLeaveRequest && leaveReceiverEmpId ? [leaveReceiverEmpId] : isPurchaseRequest && purchaseReceiverEmpId ? [purchaseReceiverEmpId] : isTrainingTemplate && trainingReceiverEmpId ? [trainingReceiverEmpId] : isEquipmentProposal && peManagerId ? [peManagerId] : []
    });
    setDefaultLineMessage("");
    setTemplateModalOpen(false);
    setMode("create");
    void applyDefaultLine(previewTemplate.code);
    if (isLeaveRequest || isLeaveCancel) {
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
  }

  function validateDraftLine(receiverEmpIds = form.receiverEmpIds) {
    const restricted = [...form.agreementEmpIds, ...form.approverEmpIds, ...receiverEmpIds];
    if (form.agreementEmpIds.includes(user.empId) || form.approverEmpIds.includes(user.empId)) {
      return "기안자 본인은 합의자 또는 결재자로 지정할 수 없습니다.";
    }
    if (new Set(restricted).size !== restricted.length) {
      return "합의자, 결재자, 수신자는 중복 지정할 수 없습니다.";
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
    const isDelegationEligible = isLeaveRequest || isTrainingRequest || isTrainingReport;
    const peManagerId = productionEngineeringManagerId(employees);
    const leaveReceiverEmpId = leaveReceiverId(employees);
    const purchaseReceiverEmpId = purchaseReceiverId(employees);
    const trainingReceiverEmpId = trainingReceiverId(employees);
    const receiverEmpIds = isLeaveRequest && leaveReceiverEmpId ? [leaveReceiverEmpId] : isPurchaseRequest && purchaseReceiverEmpId ? [purchaseReceiverEmpId] : isTrainingTemplate && trainingReceiverEmpId ? [trainingReceiverEmpId] : isEquipmentProposal && peManagerId ? [peManagerId] : form.receiverEmpIds;
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
    const leaveReceiverEmpId = leaveReceiverId(employees);
    const purchaseReceiverEmpId = purchaseReceiverId(employees);
    const trainingReceiverEmpId = trainingReceiverId(employees);
    const requesterDeptName = currentUserDeptName(user, employees, form.fieldValues.requestDeptName ?? "");
    setForm({
      ...form,
      templateCode,
      templateVersion: nextTemplate.version ?? null,
      title: isPurchaseRequest || isTrainingTemplate || isEquipmentProposal ? "" : shouldUseTemplateTitle ? nextTemplate.name : form.title,
      fieldValues: isEquipmentProposal ? { requestDeptName: requesterDeptName } : isPurchaseRequest ? purchaseDefaultFieldValues(user, employees) : isTrainingRequest ? trainingRequestDefaultFieldValues(user, employees) : isTrainingReport ? trainingReportDefaultFieldValues(user, employees) : isLeaveRequest || isLeaveCancel ? leaveUsageFieldValues(leaveUsage) : {},
      receiverEmpIds: isLeaveRequest && leaveReceiverEmpId ? [leaveReceiverEmpId] : isPurchaseRequest && purchaseReceiverEmpId ? [purchaseReceiverEmpId] : isTrainingTemplate && trainingReceiverEmpId ? [trainingReceiverEmpId] : isEquipmentProposal && peManagerId ? [peManagerId] : []
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

  const selectedTemplate = approvalTemplateByCode(templates, form.templateCode) ?? DEFAULT_APPROVAL_TEMPLATES[0];
  const selectableTemplates = selectableApprovalTemplates(templates);
  const isClassicDraftForm = isDraftTemplateCode(selectedTemplate.code);
  const isLeaveRequestForm = isLeaveTemplateCode(selectedTemplate.code);
  const isLeaveCancelForm = isLeaveCancelTemplateCode(selectedTemplate.code);
  const isPurchaseRequestForm = isPurchaseTemplateCode(selectedTemplate.code);
  const isTrainingRequestForm = isTrainingRequestTemplateCode(selectedTemplate.code);
  const isTrainingReportForm = isTrainingReportTemplateCode(selectedTemplate.code);
  const isEquipmentProposalForm = isEquipmentProposalTemplateCode(selectedTemplate.code);
  const isDelegationEligibleForm = isLeaveRequestForm || isTrainingRequestForm || isTrainingReportForm;
  const restrictedIds = [...form.agreementEmpIds, ...form.approverEmpIds, ...form.receiverEmpIds];
  const peManagerEmployee = employees.find((employee) => employee.empId === productionEngineeringManagerId(employees));
  const permissions = selected?.permissions;
  const equipmentInputStage = equipmentProposal?.workflowStage === "PE_INPUT" || equipmentProposal?.workflowStage === "PURCHASE_INPUT";
  const primaryApprovalViews = [
    { id: "todo", label: "결재할 문서", box: "pending" as ApprovalBox, dashboardFilter: "actionRequired" as ApprovalDashboardFilter },
    { id: "progress", label: "결재진행문서", box: "processed" as ApprovalBox, dashboardFilter: "approvedInProgress" as ApprovalDashboardFilter },
    { id: "drafts", label: "임시보관함", box: "requested" as ApprovalBox, dashboardFilter: "drafts" as ApprovalDashboardFilter }
  ];
  const activePrimaryApprovalViewId = (
    mode !== "templates" && mode !== "delegation" && mode !== "operationSettings" && mode !== "deleted"
      ? dashboardFilter?.dashboardFilter === "actionRequired" ? "todo"
        : dashboardFilter?.dashboardFilter === "approvedInProgress" ? "progress"
          : dashboardFilter?.dashboardFilter === "drafts" ? "drafts"
            : ""
      : ""
  );
  const isPrimaryDashboardFilter = ["actionRequired", "approvedInProgress", "drafts", "completedInvolved"].includes(dashboardFilter?.dashboardFilter ?? "");
  const approvalListLabel = dashboardFilter?.label ?? (box === "requested" ? "임시보관함" : approvalBoxes.find((item) => item.box === box)?.label ?? "문서");

  return (
    <section className="panel board-screen approval-screen">
      <div className="approval-category-tabs">
        <button type="button" className={approvalCategory === "active" ? "active" : ""} onClick={() => void changeApprovalCategory("active")}>전자결재</button>
        <button type="button" className={approvalCategory === "completed" ? "active" : ""} onClick={() => void changeApprovalCategory("completed")}>결재 완료문서</button>
      </div>
      <div className="board-tabs approval-tabs">
        {approvalCategory === "active" && primaryApprovalViews.map((view) => (
          <button key={view.id} className={activePrimaryApprovalViewId === view.id ? "active" : ""} onClick={() => void openApprovalWorkView(view)}>{view.label}</button>
        ))}
        {approvalCategory === "active" && (
          <div className="approval-tab-actions">
            <button type="button" className={mode === "delegation" ? "active" : ""} onClick={() => void openDelegationSettings()}>대리설정</button>
            {isApprovalAdmin && <button type="button" className={mode === "templates" ? "active" : ""} onClick={() => void openTemplateAdmin()}>양식관리</button>}
            {isApprovalAdmin && <button type="button" className={mode === "operationSettings" ? "active" : ""} onClick={() => void openOperationSettings()}>운영설정</button>}
            {isApprovalAdmin && <button type="button" className={mode === "deleted" ? "active" : ""} onClick={() => void openDeletedApprovals()}>보존삭제함</button>}
          </div>
        )}
      </div>
      {mode !== "templates" && mode !== "delegation" && mode !== "operationSettings" && mode !== "deleted" && <Toolbar title={approvalCategory === "completed" ? "결재 완료문서" : "전자결재"} onNew={startCreate} onRefresh={() => load(box, dashboardFilter?.dashboardFilter ?? null)} />}
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
            {isApprovalAdmin && (
              <div className="approval-actions approval-actions-admin">
                <button className="ghost" onClick={() => void correctStatus()}><RefreshCw size={16} /> 상태 보정</button>
                <button className="danger" onClick={() => void deleteForRetention()}><Trash2 size={16} /> 보존삭제</button>
              </div>
            )}
          </div>
        </div>
      )}
      {mode === "delegation" && (
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
      {mode === "templates" && isApprovalAdmin && (
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
                <EmployeeMultiPicker title="수신자" user={user} employees={employees} selectedIds={templateLineForm.receiverEmpIds} disabledIds={[...templateLineForm.agreementEmpIds, ...templateLineForm.approverEmpIds]} onChange={(receiverEmpIds) => setTemplateLineForm({ ...templateLineForm, receiverEmpIds })} />
                <EmployeeMultiPicker title="참조자" user={user} employees={employees} selectedIds={templateLineForm.referenceEmpIds} disabledIds={[]} onChange={(referenceEmpIds) => setTemplateLineForm({ ...templateLineForm, referenceEmpIds })} />
                <EmployeeMultiPicker title="연람자" user={user} employees={employees} selectedIds={templateLineForm.readerEmpIds} disabledIds={[]} onChange={(readerEmpIds) => setTemplateLineForm({ ...templateLineForm, readerEmpIds })} />
              </div>
            </div>
          )}
        </div>
      )}
      {mode === "operationSettings" && isApprovalAdmin && (
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
          {operationSettings && (
            <div className="template-note">
              <strong>기본값</strong>
              <span>처리 기한 {operationSettings.fallbackDecisionDueHours}시간 · 알림 간격 {operationSettings.fallbackReminderFixedDelayMs}ms · 보관 {operationSettings.fallbackDeletedDocumentRetentionDays}일 · 영구삭제 {operationSettings.fallbackPermanentDeleteEnabled ? "허용" : "차단"}</span>
            </div>
          )}
        </div>
      )}
      {mode === "deleted" && isApprovalAdmin && (
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
      {mode === "list" && (
        <>
          <form className="approval-search-panel" onSubmit={applyApprovalSearch}>
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
                {templates.map((template) => (
                  <option key={`${template.code}-${template.version ?? "latest"}`} value={template.code}>{template.name}</option>
                ))}
              </select>
            </label>
            {approvalCategory === "completed" && (
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
            )}
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
          </form>
          {dashboardFilter && !isPrimaryDashboardFilter && (
            <div className="approval-filter-banner">
              <span>{dashboardFilter.label} 기준으로 표시 중</span>
              <button type="button" className="ghost" onClick={() => void changeBox(dashboardFilter.box)}>필터 해제</button>
            </div>
          )}
          <ListSummary count={items.length} text={`${approvalListLabel} 문서`} />
          {items.length ? <ApprovalListTable items={items} templates={templates} onOpen={loadDetail} /> : <Empty text="게시글이 없습니다." />}
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
            employees={employees}
            onSavePurchaseDeliveryDate={savePurchaseDeliveryDate}
            onSubmitPurchaseApprovalLine={submitPurchaseApprovalLine}
            onSaveEquipment={saveEquipmentProposalDraft}
            onSubmitEquipmentStage={submitEquipmentStage}
            onAssignEquipmentAssignee={assignEquipmentAssignee}
          />
          <AttachmentBox targetType="APPROVAL_DOCUMENT" targetId={selected.approvalId} readOnly={!permissions?.canEditDraft} canDownload={!!permissions?.canDownloadAttachment} />
        </DetailPage>
      )}
      {(mode === "create" || mode === "edit") && (
        <DetailPage onBack={() => selected ? setMode("detail") : setMode("list")}>
          <div className="editor approval-editor">
            <div className="panel-head">
              <div>
                <h3>{mode === "edit" ? "전자결재 수정" : "전자결재 작성"}</h3>
                <p className="muted-text">문서번호는 상신 시 자동 생성됩니다. 예상 형식: {documentPrefix(form.templateCode)}-{new Date().getFullYear()}-자동생성</p>
              </div>
              <div className="actions">
                <button type="button" className="ghost" onClick={() => void savePersonalDefaultLine()}><Save size={16} /> 개인 기본 결재선 저장</button>
                <button type="button" className="ghost" onClick={() => void save(false)}><Save size={16} /> 임시저장</button>
                <button type="button" onClick={() => void save(true)}><Check size={16} /> 상신</button>
                <button type="button" className="ghost" onClick={() => selected ? setMode("detail") : setMode("list")}><X size={16} /> 취소</button>
              </div>
            </div>
            {defaultLineMessage && <p className="template-note"><span>{defaultLineMessage}</span></p>}
            <div className="approval-line-library">
              <label>저장된 결재라인
                <select value={selectedSavedLineId} onChange={(event) => setSelectedSavedLineId(event.target.value)}>
                  {savedApprovalLines.length ? savedApprovalLines.map((line) => (
                    <option key={line.defaultLineId ?? line.lineName} value={line.defaultLineId ?? ""}>{line.lineName}</option>
                  )) : <option value="">저장된 결재라인 없음</option>}
                </select>
              </label>
              <button type="button" className="ghost" onClick={applySavedApprovalLine} disabled={!savedApprovalLines.length}>불러오기</button>
              <button type="button" className="ghost" onClick={() => void renameSavedApprovalLine()} disabled={!savedApprovalLines.length}>이름 변경</button>
              <button type="button" className="ghost danger" onClick={() => void deleteSavedApprovalLine()} disabled={!savedApprovalLines.length}>삭제</button>
              <button type="button" className="ghost" onClick={() => void saveNamedApprovalLine()}><Save size={16} /> 현재 결재라인 저장</button>
            </div>
            {isClassicDraftForm && <ClassicDraftEditor user={user} employees={employees} form={form} onChange={setForm} />}
            {(isLeaveRequestForm || isLeaveCancelForm) && <LeaveRequestEditor mode={isLeaveCancelForm ? "cancel" : "request"} user={user} employees={employees} form={form} leaveUsage={leaveUsage} onChange={setForm} />}
            {isPurchaseRequestForm && <PurchaseRequestEditor user={user} employees={employees} form={form} onChange={setForm} />}
            {isTrainingRequestForm && <TrainingRequestEditor user={user} employees={employees} form={form} onChange={setForm} />}
            {isTrainingReportForm && <TrainingReportEditor user={user} employees={employees} form={form} onChange={setForm} />}
            {isEquipmentProposalForm && <EquipmentProposalEditor user={user} employees={employees} form={form} onChange={setForm} />}
            {!isClassicDraftForm && !isLeaveRequestForm && !isLeaveCancelForm && !isPurchaseRequestForm && !isTrainingRequestForm && !isTrainingReportForm && !isEquipmentProposalForm && (
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
            <div className="line-picker-grid">
              <EmployeeMultiPicker title={isClassicDraftForm ? "경유/협조" : "합의자"} user={user} employees={employees} selectedIds={form.agreementEmpIds} disabledIds={[user.empId, ...form.approverEmpIds, ...form.receiverEmpIds]} onChange={(agreementEmpIds) => setForm({ ...form, agreementEmpIds })} />
              <EmployeeMultiPicker title="결재자" user={user} employees={employees} selectedIds={form.approverEmpIds} disabledIds={[user.empId, ...form.agreementEmpIds, ...form.receiverEmpIds]} ordered onChange={(approverEmpIds) => setForm({ ...form, approverEmpIds })} />
              {isEquipmentProposalForm ? (
                <div className="line-picker-card">
                  <div className="panel-head">
                    <h3>수신자</h3>
                    <span className="fixed-chip">자동 지정</span>
                  </div>
                  {peManagerEmployee ? (
                    <div className="selected-approver">
                      <strong>{peManagerEmployee.empName}</strong>
                      <span>{peManagerEmployee.deptName ?? "-"} · {peManagerEmployee.positionName ?? peManagerEmployee.jobTitle ?? "-"}</span>
                    </div>
                  ) : <Empty text="생산기술팀장 계정을 찾지 못했습니다." />}
                </div>
              ) : (
                <EmployeeMultiPicker title="수신자" user={user} employees={employees} selectedIds={form.receiverEmpIds} disabledIds={[...form.agreementEmpIds, ...form.approverEmpIds]} onChange={(receiverEmpIds) => setForm({ ...form, receiverEmpIds })} />
              )}
              <EmployeeMultiPicker title="참조자" user={user} employees={employees} selectedIds={form.referenceEmpIds} disabledIds={[]} onChange={(referenceEmpIds) => setForm({ ...form, referenceEmpIds })} />
              <EmployeeMultiPicker title="연람자" user={user} employees={employees} selectedIds={form.readerEmpIds} disabledIds={[]} onChange={(readerEmpIds) => setForm({ ...form, readerEmpIds })} />
            </div>
          </div>
        </DetailPage>
      )}
      {templateModalOpen && (
        <TemplateSelectModalV2
          templates={templates}
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

function equipmentCompletionReportId(approval: Approval): number | null {
  if (approval.templateCode !== "EQUIPMENT_WORK_COMPLETION" || !approval.formDataJson) return null;
  try {
    const reportId = JSON.parse(approval.formDataJson).reportId;
    return typeof reportId === "number" && Number.isInteger(reportId) ? reportId : null;
  } catch {
    return null;
  }
}
