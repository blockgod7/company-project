import {
  ArrowLeft,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Download,
  Edit3,
  Eye,
  Flag,
  Home,
  Inbox,
  LogOut,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { api, authenticatedFetch, clearTokens, jsonBody, setTokens } from "./api";
import schunkLogo from "./assets/schunk-carbon-logo.png";
import type {
  AuditLog,
  AttachFile,
  Approval,
  ApprovalDashboard,
  ApprovalDelegationApi,
  ApprovalDefaultLineApi,
  ApprovalDefaultLineStepApi,
  ApprovalLine,
  ApprovalOperationSettings,
  ApprovalSummary,
  ApprovalTemplateApi,
  Board,
  BoardPost,
  DeptNode,
  Employee,
  EquipmentProposal,
  LeaveUsage,
  LoginResponse,
  Notice,
  NotificationItem,
  PageResponse,
  User
} from "./types";

type Route = "dashboard" | "notices" | "boards" | "approvals" | "notifications" | "organization" | "audit";
type ContentMode = "list" | "detail" | "create" | "edit" | "templates" | "delegation" | "operationSettings" | "deleted";
type NoticeForm = { title: string; content: string; pinned: boolean };
type BoardForm = { title: string; content: string; draft: boolean };
type ApprovalDelegationForm = { delegateEmpId: number | null; startDate: string; endDate: string; reason: string; active: boolean };
type ApprovalOperationSettingsForm = { decisionDueHours: number; reminderFixedDelayMs: number; deletedDocumentRetentionDays: number; permanentDeleteEnabled: boolean };
type ApprovalTemplateOption = {
  code: string;
  name: string;
  description: string;
  version?: number | null;
  fieldsJson?: string;
  printLayoutJson?: string | null;
  activeYn?: "Y" | "N";
  sortOrder?: number;
};
type ApprovalTemplateCategory = {
  id: string;
  label: string;
  codes: string[];
};
type ApprovalTemplateAdminForm = {
  templateCode: string;
  templateName: string;
  description: string;
  fieldsJson: string;
  printLayoutJson: string;
  sortOrder: number;
  active: boolean;
};
type ApprovalTemplateField = {
  name: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean | string;
};
type ApprovalBox = "agreement" | "pending" | "received" | "shared" | "requested" | "processed" | "all";
type ApprovalDashboardFilter = "myPending" | "delegatedPending" | "overdue" | "requestedInProgress" | "recentCompleted";
type ApprovalLaunch = { box: ApprovalBox; dashboardFilter?: ApprovalDashboardFilter; label: string };
type ApprovalSearchForm = {
  keyword: string;
  status: string;
  templateCode: string;
  dateFrom: string;
  dateTo: string;
};
type ApprovalForm = {
  title: string;
  content: string;
  fieldValues: Record<string, string>;
  templateCode: string;
  templateVersion: number | null;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  agreementEmpIds: number[];
  approverEmpIds: number[];
  receiverEmpIds: number[];
  referenceEmpIds: number[];
  readerEmpIds: number[];
};
type AttachmentPresence = Record<number, boolean>;
type DraftAttachment = { id: string; file: File };
type LoginOption = { loginId: string; empName: string; deptName?: string | null; positionName?: string | null; roleCode: string };
type ApprovalBoxApi = { code: string; label: string };
type MoldFixturePart = {
  partName: string;
  cavity: string;
  material: string;
  quantity: string;
  moldNo: string;
};
type PurchaseRequestItem = {
  itemName: string;
  spec: string;
  quantity: string;
  usage: string;
};
type LeaveSelection = {
  date: string;
  type: string;
  days: number;
};

const PURCHASE_RECEIVER_LOGIN_ID = "lim.purchase";
const PURCHASE_BU_CODES = ["BU1", "BU2", "BU3", "BU4", "BU5", "BU7", "BU9", "BU20", "EC", "BU60"] as const;

const DEFAULT_APPROVAL_TEMPLATES: ApprovalTemplateOption[] = [
  { code: "GENERAL", name: "일반문서", description: "일반 업무 기안", version: 1 },
  { code: "PURCHASE", name: "구매요청서", description: "물품 또는 서비스 구매 요청", version: 1 },
  { code: "EQUIPMENT_PROPOSAL", name: "설비 품의서", description: "사용부서, 생산기술팀, 구매팀이 단계별로 작성하는 설비 품의서", version: 1 },
  { code: "MOLD_FIXTURE_PROPOSAL", name: "금형 치공구 품의서", description: "설비 품의서와 동일한 단계로 작성하는 금형 치공구 품의서", version: 1 },
  { code: "TRAINING_REQUEST", name: "교육계획서", description: "교육 계획 및 비용 승인", version: 1 },
  { code: "TRAINING_REPORT", name: "교육기록서", description: "교육 결과 및 참석 기록", version: 1 },
  { code: "MONTHLY_MAINTENANCE", name: "월간보전계획서", description: "월간 보전 계획", version: 1 },
  { code: "ANNUAL_MAINTENANCE", name: "연간보전계획서", description: "연간 보전 계획", version: 1 },
  { code: "EQUIPMENT_REPAIR", name: "설비수리보고서", description: "설비 수리 결과 보고", version: 1 }
];

const DEFAULT_APPROVAL_SEARCH: ApprovalSearchForm = {
  keyword: "",
  status: "",
  templateCode: "",
  dateFrom: "",
  dateTo: ""
};
const APPROVAL_TEMPLATE_CATEGORIES: ApprovalTemplateCategory[] = [
  { id: "draft", label: "1. 기안 공문", codes: ["DRAFT", "EQUIPMENT_PROPOSAL", "MOLD_FIXTURE_PROPOSAL"] },
  { id: "leave", label: "2. 휴가, 출장", codes: ["LEAVE", "LEAVE_CANCEL"] },
  { id: "purchase", label: "3. 구매", codes: ["PURCHASE"] },
  { id: "education", label: "4. 교육 및 제안", codes: ["TRAINING_REQUEST", "TRAINING_REPORT"] }
];
const ENABLE_TEMPLATE_FALLBACK = import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEMPLATE_FALLBACK === "true";
const LEAVE_TYPE_OPTIONS = [
  "연차",
  "오전반차",
  "오후반차",
  "공가",
  "공가(오전)",
  "공가(오후)",
  "경조",
  "산휴",
  "출장",
  "외근",
  "기타",
  "대체휴무",
  "병가",
  "교육",
  "휴무",
  "육아휴직",
  "자녀돌봄휴가"
];
const DEFAULT_TOTAL_ANNUAL_DAYS = "22";
const KOREAN_PUBLIC_HOLIDAYS: Record<string, string> = {
  "2026-01-01": "신정",
  "2026-02-16": "설날",
  "2026-02-17": "설날",
  "2026-02-18": "설날",
  "2026-03-01": "삼일절",
  "2026-03-02": "대체공휴일",
  "2026-05-01": "근로자의 날",
  "2026-05-05": "어린이날",
  "2026-05-24": "부처님오신날",
  "2026-05-25": "대체공휴일",
  "2026-06-03": "지방선거",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-08-17": "대체공휴일",
  "2026-09-24": "추석",
  "2026-09-25": "추석",
  "2026-09-26": "추석",
  "2026-10-03": "개천절",
  "2026-10-05": "대체공휴일",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절"
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function defaultDelegationForm(): ApprovalDelegationForm {
  return {
    delegateEmpId: null,
    startDate: todayDate(),
    endDate: "",
    reason: "",
    active: true
  };
}

function defaultOperationSettingsForm(): ApprovalOperationSettingsForm {
  return {
    decisionDueHours: 72,
    reminderFixedDelayMs: 300000,
    deletedDocumentRetentionDays: 1825,
    permanentDeleteEnabled: false
  };
}

function defaultApprovalForm(templates = DEFAULT_APPROVAL_TEMPLATES): ApprovalForm {
  const template = templates[0] ?? DEFAULT_APPROVAL_TEMPLATES[0];
  return {
    title: template.name,
    content: "",
    fieldValues: {},
    templateCode: template.code,
    templateVersion: template.version ?? null,
    priority: "NORMAL",
    agreementEmpIds: [],
    approverEmpIds: [],
    receiverEmpIds: [],
    referenceEmpIds: [],
    readerEmpIds: []
  };
}

function approvalTemplateByCode(templates: ApprovalTemplateOption[], templateCode: string | null | undefined) {
  if (!templateCode) return undefined;
  return templates.find((item) => item.code === templateCode)
    ?? DEFAULT_APPROVAL_TEMPLATES.find((item) => item.code === templateCode);
}

function categorizedTemplateGroups(templates: ApprovalTemplateOption[]) {
  const byCode = new Map(templates.map((template) => [template.code, template]));
  return APPROVAL_TEMPLATE_CATEGORIES
    .map((category) => ({
      ...category,
      templates: category.codes
        .map((code) => byCode.get(code))
        .filter((template): template is ApprovalTemplateOption => Boolean(template))
    }))
    .filter((category) => category.templates.length > 0);
}

function selectableApprovalTemplates(templates: ApprovalTemplateOption[]) {
  return categorizedTemplateGroups(templates).flatMap((category) => category.templates);
}

function firstSelectableApprovalTemplate(templates: ApprovalTemplateOption[]) {
  return selectableApprovalTemplates(templates)[0] ?? templates[0] ?? DEFAULT_APPROVAL_TEMPLATES[0];
}

function idsFromJson(value: unknown) {
  return Array.isArray(value) ? value.filter((id): id is number => typeof id === "number") : [];
}

function clampApprovalSlotCount(count: number) {
  return Math.min(6, Math.max(2, count));
}

function approvalDraftData(approval: Approval) {
  try {
    const parsed = approval.formDataJson ? JSON.parse(approval.formDataJson) : {};
    const fieldValues = parsed.fields && typeof parsed.fields === "object" && !Array.isArray(parsed.fields)
      ? Object.fromEntries(Object.entries(parsed.fields).map(([key, value]) => [key, value == null ? "" : String(value)]))
      : {};
    return {
      content: typeof parsed.content === "string" ? parsed.content : approval.content,
      fieldValues,
      agreementEmpIds: idsFromJson(parsed.agreementEmpIds),
      approverEmpIds: idsFromJson(parsed.approverEmpIds),
      receiverEmpIds: idsFromJson(parsed.receiverEmpIds),
      referenceEmpIds: idsFromJson(parsed.referenceEmpIds),
      readerEmpIds: idsFromJson(parsed.readerEmpIds)
    };
  } catch {
    return { content: approval.content === "{content=}" ? "" : approval.content, fieldValues: {}, agreementEmpIds: [], approverEmpIds: [], receiverEmpIds: [], referenceEmpIds: [], readerEmpIds: [] };
  }
}

function approvalContent(approval: Approval) {
  const draftData = approvalDraftData(approval);
  return approval.content === "{content=}" ? draftData.content : approval.content;
}

function isDraftTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "DRAFT";
}

function isLeaveTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "LEAVE";
}

function isLeaveCancelTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "LEAVE_CANCEL";
}

function isPurchaseTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "PURCHASE";
}

function isEquipmentProposalTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "EQUIPMENT_PROPOSAL" || templateCode === "MOLD_FIXTURE_PROPOSAL";
}

function equipmentProposalTitle(templateCode: string | null | undefined) {
  return templateCode === "MOLD_FIXTURE_PROPOSAL" ? "금형 치공구 품의서" : "설비 품의서";
}

function equipmentProposalItemLabel(templateCode: string | null | undefined) {
  return templateCode === "MOLD_FIXTURE_PROPOSAL" ? "금형/치공구명" : "설비명";
}

function equipmentProposalCapacityLabel(templateCode: string | null | undefined) {
  return templateCode === "MOLD_FIXTURE_PROPOSAL" ? "규격/용도" : "설비용량(능력)";
}

function equipmentProposalItemFallback(templateCode: string | null | undefined) {
  return templateCode === "MOLD_FIXTURE_PROPOSAL" ? "금형 치공구" : "설비";
}

function equipmentProposalGeneratedTitle(values: Record<string, string>, templateCode: string | null | undefined) {
  const itemName = (isMoldFixtureTemplateCode(templateCode) ? values.moldNo : values.equipmentName)?.trim()
    || equipmentProposalItemFallback(templateCode);
  const requestType = values.requestType?.trim();
  return `${itemName}${requestType ? ` ${requestType}` : ""} 품의서`;
}

function isMoldFixtureTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "MOLD_FIXTURE_PROPOSAL";
}

function blankMoldFixturePart(): MoldFixturePart {
  return { partName: "", cavity: "", material: "", quantity: "", moldNo: "" };
}

function normalizeMoldFixtureParts(parts: MoldFixturePart[]) {
  const normalized = parts.length ? parts : [blankMoldFixturePart()];
  return normalized.map((part) => ({
    partName: part.partName ?? "",
    cavity: part.cavity ?? "",
    material: part.material ?? "",
    quantity: part.quantity ?? "",
    moldNo: part.moldNo ?? ""
  }));
}

function parseMoldFixtureParts(values: Record<string, unknown> | EquipmentProposal): MoldFixturePart[] {
  const raw = "moldPartsJson" in values ? values.moldPartsJson : undefined;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const rows = parsed.map((item) => ({
          partName: String(item?.partName ?? ""),
          cavity: String(item?.cavity ?? ""),
          material: String(item?.material ?? ""),
          quantity: String(item?.quantity ?? ""),
          moldNo: String(item?.moldNo ?? "")
        }));
        if (rows.length) return rows;
      }
    } catch {
      // Fall back to legacy single-row fields.
    }
  }
  const legacy = {
    partName: String(values.partName ?? ""),
    cavity: String(values.cavity ?? ""),
    material: String(values.material ?? ""),
    quantity: String(values.quantity ?? ""),
    moldNo: String(values.moldNo ?? "")
  };
  return Object.values(legacy).some((value) => value.trim()) ? [legacy] : [blankMoldFixturePart()];
}

function moldFixturePartsJson(parts: MoldFixturePart[]) {
  return JSON.stringify(normalizeMoldFixtureParts(parts));
}

function blankPurchaseItem(): PurchaseRequestItem {
  return { itemName: "", spec: "", quantity: "", usage: "" };
}

function normalizePurchaseItems(items: PurchaseRequestItem[]) {
  const normalized = items.length ? items : [blankPurchaseItem()];
  return normalized.map((item) => ({
    itemName: item.itemName ?? "",
    spec: item.spec ?? "",
    quantity: item.quantity ?? "",
    usage: item.usage ?? ""
  }));
}

function parsePurchaseItems(values: Record<string, unknown>): PurchaseRequestItem[] {
  const raw = values.purchaseItemsJson;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const rows = parsed.map((item) => ({
          itemName: String(item?.itemName ?? ""),
          spec: String(item?.spec ?? ""),
          quantity: String(item?.quantity ?? ""),
          usage: String(item?.usage ?? "")
        }));
        if (rows.length) return rows;
      }
    } catch {
      return [blankPurchaseItem()];
    }
  }
  return [blankPurchaseItem()];
}

function purchaseItemsJson(items: PurchaseRequestItem[]) {
  return JSON.stringify(normalizePurchaseItems(items));
}

function purchaseBuTotal(values: Record<string, string>) {
  return PURCHASE_BU_CODES.reduce((sum, code) => sum + Number(values[`bu_${code}`] || 0), 0);
}

function purchaseDefaultFieldValues(user: User, employees: Employee[], current: Record<string, string> = {}): Record<string, string> {
  return {
    requestDeptName: currentUserDeptName(user, employees, current.requestDeptName ?? ""),
    requesterName: user.empName,
    requestDate: current.requestDate || todayDate(),
    requiredDate: current.requiredDate ?? "",
    receiptDate: current.receiptDate ?? "",
    deliveryDate: current.deliveryDate ?? "",
    purchaseItemsJson: current.purchaseItemsJson || purchaseItemsJson([blankPurchaseItem()]),
    ...(Object.fromEntries(PURCHASE_BU_CODES.map((code) => [`bu_${code}`, current[`bu_${code}`] ?? ""])) as Record<string, string>)
  };
}

function purchaseReceiverId(employees: Employee[]) {
  return employees.find((employee) => employee.loginId === PURCHASE_RECEIVER_LOGIN_ID)?.empId ?? null;
}

function purchaseReceiptDate(lines: ApprovalLine[]) {
  const receiver = lines
    .filter((line) => line.lineType === "RECEIVER")
    .sort((a, b) => a.lineOrder - b.lineOrder)
    .find((line) => line.readAt || line.actedAt);
  return receiver?.readAt ?? receiver?.actedAt ?? "";
}

function purchaseRequestContent(values: Record<string, string>) {
  const items = parsePurchaseItems(values).filter((item) => Object.values(item).some((value) => value.trim()));
  const first = items[0];
  return [
    `요구일: ${values.requiredDate ?? ""}`,
    first ? `대표품목: ${first.itemName || "-"} / ${first.spec || "-"} / ${first.quantity || "-"}` : "",
    `BU 분할 합계: ${purchaseBuTotal(values)}%`
  ].filter(Boolean).join("\n");
}

function validatePurchaseRequest(values: Record<string, string>, title: string) {
  if (!title.trim()) return "구매요구서 제목을 입력해 주세요.";
  if (!values.requiredDate?.trim()) return "요구일을 입력해 주세요.";
  const items = parsePurchaseItems(values).filter((item) => Object.values(item).some((value) => value.trim()));
  if (!items.length) return "구매 품목을 1건 이상 입력해 주세요.";
  const invalidItem = items.find((item) => !item.itemName.trim() || !item.spec.trim() || !item.quantity.trim() || !item.usage.trim());
  if (invalidItem) return "품명, 규격, 수량, 용도를 모두 입력해 주세요.";
  const total = purchaseBuTotal(values);
  return Math.abs(total - 100) > 0.0001 ? "BU 비용분할 합계는 100%가 되어야 합니다." : "";
}

function employeeDisplay(employee?: Employee) {
  if (!employee) return "-";
  return `${employee.deptName ?? "-"} ${employee.empName}`;
}

function currentUserDeptName(user: User, employees: Employee[] = [], fallback = "") {
  return user.deptName?.trim()
    || employees.find((employee) => employee.empId === user.empId)?.deptName?.trim()
    || fallback.trim();
}

function employeesByIds(employees: Employee[], ids: number[]) {
  return ids.map((id) => employees.find((employee) => employee.empId === id)).filter((employee): employee is Employee => !!employee);
}

function formatEmployeeList(employees: Employee[], ids: number[]) {
  const selected = employeesByIds(employees, ids);
  return selected.length ? selected.map(employeeDisplay).join(", ") : "-";
}

function approvalLinePerson(line: ApprovalLine) {
  const dept = line.deptNameSnapshot ?? line.approverDeptName ?? "-";
  const name = line.empNameSnapshot ?? line.approverName;
  return `${dept} ${name}`;
}

function formatApprovalLines(lines: ApprovalLine[], lineType: ApprovalLine["lineType"]) {
  const selected = lines.filter((line) => line.lineType === lineType).sort((a, b) => a.lineOrder - b.lineOrder);
  return selected.length ? selected.map(approvalLinePerson).join(", ") : "-";
}

function approvalOpinionLines(lines: ApprovalLine[]) {
  return lines
    .filter((line) => (line.lineType === "AGREEMENT" || line.lineType === "APPROVAL") && line.comment?.trim())
    .sort((a, b) => a.lineOrder - b.lineOrder);
}

function defaultLineIds(steps: ApprovalDefaultLineStepApi[], lineType: ApprovalDefaultLineStepApi["lineType"]) {
  return steps
    .filter((step) => step.lineType === lineType)
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((step) => step.approverEmpId);
}

function productionEngineeringManagerId(employees: Employee[]) {
  const manager = employees.find((employee) =>
    employee.deptName === "생산기술" && (employee.roleCode === "MANAGER" || employee.jobTitle?.includes("팀장") || employee.positionName?.includes("팀장"))
  );
  return manager?.empId ?? employees.find((employee) => employee.loginId === "cho.pe")?.empId ?? null;
}

function isDeptManagerUser(user: User, employees: Employee[], deptName: string) {
  const employee = employees.find((item) => item.empId === user.empId);
  const userDeptName = user.deptName ?? employee?.deptName;
  const roleCode = employee?.roleCode ?? user.roleCode;
  return userDeptName === deptName
    && (roleCode === "MANAGER"
      || roleCode === "APPROVAL_ADMIN"
      || roleCode === "ADMIN"
      || employee?.jobTitle?.includes("팀장")
      || employee?.positionName?.includes("팀장"));
}

function defaultLinePayload(form: ApprovalForm, lineName = "내 기본 결재선", includeReceivers = true) {
  let order = 1;
  const steps = [
    ...form.agreementEmpIds.map((approverEmpId) => ({ stepOrder: order++, approverEmpId, lineType: "AGREEMENT", required: true })),
    ...form.approverEmpIds.map((approverEmpId) => ({ stepOrder: order++, approverEmpId, lineType: "APPROVAL", required: true })),
    ...(includeReceivers ? form.receiverEmpIds.map((approverEmpId) => ({ stepOrder: order++, approverEmpId, lineType: "RECEIVER", required: true })) : []),
    ...form.referenceEmpIds.map((approverEmpId) => ({ stepOrder: order++, approverEmpId, lineType: "REFERENCE", required: false })),
    ...form.readerEmpIds.map((approverEmpId) => ({ stepOrder: order++, approverEmpId, lineType: "READER", required: false }))
  ];
  return {
    lineName,
    steps
  };
}

function templateOptionFromApi(item: ApprovalTemplateApi): ApprovalTemplateOption {
  return {
    code: item.templateCode,
    name: item.templateName,
    description: item.description ?? "",
    version: item.version,
    fieldsJson: item.fieldsJson,
    printLayoutJson: item.printLayoutJson,
    activeYn: item.activeYn,
    sortOrder: item.sortOrder
  };
}

function templateAdminFormFromOption(template?: ApprovalTemplateOption): ApprovalTemplateAdminForm {
  return {
    templateCode: template?.code ?? "",
    templateName: template?.name ?? "",
    description: template?.description ?? "",
    fieldsJson: template?.fieldsJson ?? "[{\"name\":\"content\",\"label\":\"내용\",\"type\":\"textarea\"}]",
    printLayoutJson: template?.printLayoutJson ?? "{}",
    sortOrder: template?.sortOrder ?? 0,
    active: template?.activeYn !== "N"
  };
}

function parseTemplateFields(fieldsJson?: string | null): ApprovalTemplateField[] {
  if (!fieldsJson) return [];
  try {
    const parsed = JSON.parse(fieldsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((field): field is Record<string, unknown> => field && typeof field === "object" && typeof field.name === "string")
      .map((field) => ({
        name: String(field.name),
        label: typeof field.label === "string" ? field.label : String(field.name),
        type: typeof field.type === "string" ? field.type : "text",
        options: Array.isArray(field.options) ? field.options.map(String) : undefined,
        required: typeof field.required === "boolean" || typeof field.required === "string" ? field.required : false
      }));
  } catch {
    return [];
  }
}

function isRequiredTemplateField(field: ApprovalTemplateField) {
  return field.required === true || String(field.required).toLowerCase() === "true" || String(field.required).toUpperCase() === "Y";
}

function leaveDayValue(type: string) {
  if (type === "연차") return 1;
  if (type === "오전반차" || type === "오후반차") return 0.5;
  return 0;
}

function formatDayValue(value?: string | number | null) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return String(Number(numeric.toFixed(1)));
}

function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLeaveSelections(values: Record<string, string> | null | undefined): LeaveSelection[] {
  if (!values?.leaveSelectionsJson) return [];
  try {
    const parsed = JSON.parse(values.leaveSelectionsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is Record<string, unknown> => item && typeof item === "object" && typeof item.date === "string")
      .map((item) => {
        const type = typeof item.type === "string" && LEAVE_TYPE_OPTIONS.includes(item.type) ? item.type : "연차";
        return {
          date: String(item.date),
          type,
          days: leaveDayValue(type)
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

function leaveSummary(selections: LeaveSelection[]) {
  return selections.map((selection) => `${formatShortDate(selection.date)} ${selection.type}`).join(", ");
}

function leaveDateRangeText(values: Record<string, string>) {
  const startDate = values.startDate ?? "";
  const endDate = values.endDate ?? "";
  const days = formatDayValue(values.days);
  if (!startDate && !endDate) return `- [ ${days} 일 ]`;
  return `${startDate || endDate} ~ ${endDate || startDate} [ ${days} 일 ]`;
}

function leaveRequestContent(values: Record<string, string>) {
  return [
    `신청기간: ${leaveDateRangeText(values)}`,
    `신청구분: ${values.leaveType ?? "-"}`,
    `연차 사용일수: ${formatDayValue(values.days)}일`,
    `신청 후 잔여 연차일수: ${formatDayValue(values.remainingAnnualDays)}일`
  ].filter(Boolean).join("\n");
}

function leaveCancelContent(values: Record<string, string>) {
  return [
    `취소기간: ${leaveDateRangeText(values)}`,
    `취소구분: ${values.leaveType ?? "-"}`,
    `취소 연차일수: ${formatDayValue(values.days)}일`
  ].filter(Boolean).join("\n");
}

function leaveUsageFieldValues(usage: LeaveUsage | null): Record<string, string> {
  return {
    usedAnnualDays: formatDayValue(usage?.usedAnnualDays ?? "0"),
    totalAnnualDays: formatDayValue(usage?.totalAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS),
    remainingAnnualDays: formatDayValue(usage?.remainingAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS)
  };
}

function withLeaveCancelTemplate(templates: ApprovalTemplateOption[]) {
  if (templates.some((template) => template.code === "LEAVE_CANCEL")) {
    return templates;
  }
  return [
    ...templates,
    {
      code: "LEAVE_CANCEL",
      name: "휴가 취소계",
      description: "승인 완료된 휴가 취소 신청",
      version: 1,
      fieldsJson: "[]",
      activeYn: "Y" as const,
      sortOrder: 999
    }
  ];
}

function remainingAnnualDaysText(totalDays: string | number | null | undefined, usedBefore: string | number | null | undefined, requestedDays: string | number | null | undefined) {
  return formatDayValue(Number(totalDays ?? 0) - Number(usedBefore ?? 0) - Number(requestedDays ?? 0));
}

const routeLabels: Record<Route, string> = {
  dashboard: "대시보드",
  notices: "공지사항",
  boards: "게시판",
  approvals: "전자결재",
  notifications: "알림",
  organization: "조직도",
  audit: "감사 로그"
};

const menu: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: "dashboard", label: "홈", icon: Home },
  { route: "notices", label: "공지사항", icon: BookOpen },
  { route: "boards", label: "통합게시판", icon: MessageSquare },
  { route: "approvals", label: "전자결재", icon: ClipboardCheck },
  { route: "organization", label: "조직도", icon: Building2 },
  { route: "notifications", label: "알림", icon: Bell }
];

function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.replace("T", " ").slice(0, 16);
}

function Empty({ text = "데이터가 없습니다." }) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <span>{text}</span>
    </div>
  );
}

async function loadAttachmentPresence(targetType: string, targetIds: number[]) {
  const pairs = await Promise.all(targetIds.map(async (targetId) => {
    try {
      const files = await api<AttachFile[]>(`/files?targetType=${targetType}&targetId=${targetId}`);
      return [targetId, files.length > 0] as const;
    } catch {
      return [targetId, false] as const;
    }
  }));
  return Object.fromEntries(pairs) as AttachmentPresence;
}

async function uploadAttachments(targetType: string, targetId: number, attachmentsToUpload: DraftAttachment[]) {
  if (!attachmentsToUpload.length) return;
  const formData = new FormData();
  formData.set("targetType", targetType);
  formData.set("targetId", String(targetId));
  attachmentsToUpload.forEach((attachment) => formData.append("files", attachment.file));
  await api<AttachFile[]>("/files/batch", { method: "POST", body: formData });
}

function displayBoardName(board: Board) {
  return board.boardName === "CRUD Test Board" ? "통합게시판" : board.boardName;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [route, setRoute] = useState<Route>("dashboard");
  const [approvalLaunch, setApprovalLaunch] = useState<ApprovalLaunch | null>(null);
  const [message, setMessage] = useState("");
  const isAdmin = user?.roleCode === "ADMIN";

  async function loadMe() {
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    }
  }

  useEffect(() => {
    if (localStorage.getItem("accessToken")) void loadMe();
    const expire = () => {
      setMessage("세션이 만료되었습니다. 다시 로그인해 주세요.");
      setUser(null);
      setRoute("dashboard");
    };
    window.addEventListener("session-expired", expire);
    return () => window.removeEventListener("session-expired", expire);
  }, []);

  function logout() {
    void api<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearTokens();
    setUser(null);
    setRoute("dashboard");
    setApprovalLaunch(null);
  }

  function navigate(route: Route) {
    if (route !== "approvals") {
      setApprovalLaunch(null);
    }
    setRoute(route);
  }

  function openApprovals(target?: ApprovalLaunch) {
    setApprovalLaunch(target ?? null);
    setRoute("approvals");
  }

  if (!user) {
    return (
      <LoginPage
        onLogin={(login) => {
          setTokens(login.accessToken);
          setUser(login);
          setMessage("");
        }}
        message={message}
      />
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img className="brand-logo" src={schunkLogo} alt="SCHUNK Carbon Technology" />
          <div>
            <strong>슝크카본테크놀로지</strong>
            <span>SCHUNK Groupware</span>
          </div>
        </div>
        <div className="profile">
          <div className="avatar"><UserRound size={38} /></div>
          <strong>{user.empName}</strong>
          <span>{user.deptName ?? "소속 미지정"} · {user.roleCode}</span>
        </div>
        <nav className="side-nav">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.route} className={route === item.route ? "side active" : "side"} onClick={() => navigate(item.route)}>
                <Icon size={19} /> {item.label}
              </button>
            );
          })}
          {isAdmin && (
            <button className={route === "audit" ? "side active" : "side"} onClick={() => navigate("audit")}>
              <Shield size={19} /> 감사 로그
            </button>
          )}
        </nav>
        <button className="logout-link" onClick={logout}>
          <LogOut size={17} /> 로그아웃
        </button>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div>
            <span>Schunk Carbon Technology Ltd.</span>
            <strong>{routeLabels[route]}</strong>
          </div>
          <div className="userbar">
            <Search size={17} />
            <span>{user.empName}</span>
            <span className="role">{user.roleCode}</span>
            <button className="icon-button" onClick={logout} title="로그아웃">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          {route === "dashboard" && <Dashboard user={user} go={navigate} openApprovals={openApprovals} />}
          {route === "notices" && <NoticePage user={user} />}
          {route === "boards" && <BoardPage user={user} />}
          {route === "approvals" && <ApprovalPage user={user} launch={approvalLaunch} />}
          {route === "notifications" && <NotificationPage go={navigate} />}
          {route === "organization" && <OrganizationPage />}
          {route === "audit" && (isAdmin ? <AuditLogPage /> : <AccessDenied />)}
        </main>
      </div>
    </div>
  );
}

function LoginPage({ onLogin, message }: { onLogin: (login: LoginResponse) => void; message: string }) {
  const [loginId, setLoginId] = useState("admin");
  const [password, setPassword] = useState("admin1234");
  const [loginOptions, setLoginOptions] = useState<LoginOption[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<LoginOption[]>("/auth/login-options")
      .then((options) => setLoginOptions(options))
      .catch(() => setLoginOptions([]));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const login = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: jsonBody({ loginId, password })
      });
      onLogin(login);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-visual">
          <img className="login-logo" src={schunkLogo} alt="SCHUNK Carbon Technology" />
          <h1>SCHUNK Groupware</h1>
          <p>업무, 공지, 게시판, 조직 정보를 한 화면에서 관리합니다.</p>
        </div>
        <div className="login-fields">
          <label>
            테스트 계정
            <select value={loginId} onChange={(event) => {
              setLoginId(event.target.value);
              setPassword("admin1234");
            }}>
              <option value="admin">admin · 관리자</option>
              {loginOptions.filter((option) => option.loginId !== "admin").map((option) => (
                <option key={option.loginId} value={option.loginId}>
                  {option.loginId} · {option.empName} · {option.deptName ?? "-"} · {option.positionName ?? option.roleCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            아이디
            <input value={loginId} onChange={(event) => setLoginId(event.target.value)} />
          </label>
          <label>
            비밀번호
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {(message || error) && <p className="error">{error || message}</p>}
          <button className="primary" type="submit">LOGIN</button>
        </div>
      </form>
    </div>
  );
}

function Dashboard({ user, go, openApprovals }: { user: User; go: (route: Route) => void; openApprovals: (target?: ApprovalLaunch) => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [approvalDashboard, setApprovalDashboard] = useState<ApprovalDashboard | null>(null);

  useEffect(() => {
    void api<PageResponse<Notice>>("/notices?size=5").then((page) => setNotices(page.content));
    void api<Board[]>("/boards").then(setBoards);
    void api<PageResponse<NotificationItem>>("/notifications?readYn=N&size=5").then((page) => setNotifications(page.content));
    void api<ApprovalDashboard>("/approvals/dashboard").then(setApprovalDashboard).catch(() => setApprovalDashboard(null));
  }, []);

  return (
    <section className="portal-grid">
      <div className="portal-card schedule-card">
        <CardHeader title="일정관리" action="예정 기능" icon={CalendarDays} />
        <div className="schedule-date">{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</div>
        <div className="empty compact">
          <CalendarDays size={34} />
          <span>캘린더 기능은 다음 단계에서 연결됩니다.</span>
        </div>
      </div>

      <div className="portal-card calendar-card">
        <CardHeader title="업무 캘린더" icon={CalendarDays} />
        <MiniCalendar />
      </div>

      <div className="portal-card board-card">
        <CardHeader title="통합게시판" action="바로가기" icon={MessageSquare} onAction={() => go("notices")} />
        <div className="tab-row">
          <span className="active">공지사항</span>
          <span>게시판</span>
          <span>알림</span>
        </div>
        {notices.length ? notices.map((notice) => (
          <button className="feed-row" key={notice.noticeId} onClick={() => go("notices")}>
            <strong>{notice.pinned ? "[고정] " : ""}{notice.title}</strong>
            <span>{formatDate(notice.createdAt)}</span>
          </button>
        )) : <Empty text="최근 공지가 없습니다." />}
      </div>

      <div className="portal-card commute-card">
        <CardHeader title="내 업무 현황" icon={UserRound} />
        <p>{user.empName}님, 오늘도 좋은 하루입니다.</p>
        <div className="action-pair">
          <button onClick={() => go("notifications")}>알림 확인</button>
          <button onClick={() => go("organization")}>조직도</button>
        </div>
      </div>

      <MetricCard icon={BookOpen} label="공지사항" value={notices.length} caption="최근 표시 건수" onClick={() => go("notices")} />
      <MetricCard icon={MessageSquare} label="게시판" value={boards.length} caption="사용 가능 게시판" onClick={() => go("boards")} />
      <MetricCard icon={Bell} label="미읽음 알림" value={notifications.length} caption="확인 필요" onClick={() => go("notifications")} />

      <div className="portal-card pending-card">
        <CardHeader title="전자결재" action="바로가기" icon={ClipboardCheck} onAction={() => openApprovals()} />
        <div className="approval-preview">
          <button type="button" onClick={() => openApprovals({ box: "pending", dashboardFilter: "myPending", label: "내 결재대기" })}><strong>{approvalDashboard?.myPendingCount ?? 0}</strong><span>내 결재대기</span></button>
          <button type="button" onClick={() => openApprovals({ box: "pending", dashboardFilter: "delegatedPending", label: "대리대기" })}><strong>{approvalDashboard?.delegatedPendingCount ?? 0}</strong><span>대리대기</span></button>
          <button type="button" onClick={() => openApprovals({ box: "pending", dashboardFilter: "overdue", label: "기한초과" })}><strong>{approvalDashboard?.overdueCount ?? 0}</strong><span>기한초과</span></button>
          <button type="button" onClick={() => openApprovals({ box: "requested", dashboardFilter: "requestedInProgress", label: "진행문서" })}><strong>{approvalDashboard?.requestedInProgressCount ?? 0}</strong><span>진행문서</span></button>
          <button type="button" onClick={() => openApprovals({ box: "requested", dashboardFilter: "recentCompleted", label: "최근완료" })}><strong>{approvalDashboard?.recentCompletedCount ?? 0}</strong><span>최근완료</span></button>
        </div>
      </div>
    </section>
  );
}

function CardHeader({ title, action, icon: Icon, onAction }: { title: string; action?: string; icon: LucideIcon; onAction?: () => void }) {
  return (
    <div className="card-head">
      <h3><Icon size={18} /> {title}</h3>
      {action && (
        <button onClick={onAction} disabled={!onAction}>
          {action} <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, caption, onClick }: { icon: LucideIcon; label: string; value: number; caption: string; onClick: () => void }) {
  return (
    <button className="portal-card metric-card" onClick={onClick}>
      <Icon size={22} />
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{caption}</small>
    </button>
  );
}

function MiniCalendar() {
  const today = new Date();
  const days = Array.from({ length: 31 }, (_, index) => index + 1);

  return (
    <div className="mini-calendar">
      <strong>{today.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</strong>
      <div className="weekdays">
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
      </div>
      <div className="days">
        {days.map((day) => <span key={day} className={day === today.getDate() ? "today" : ""}>{day}</span>)}
      </div>
    </div>
  );
}

function NoticePage({ user }: { user: User }) {
  const [items, setItems] = useState<Notice[]>([]);
  const [selected, setSelected] = useState<Notice | null>(null);
  const [mode, setMode] = useState<ContentMode>("list");
  const [form, setForm] = useState<NoticeForm>({ title: "", content: "", pinned: false });
  const [attachments, setAttachments] = useState<AttachmentPresence>({});
  const [pendingFiles, setPendingFiles] = useState<DraftAttachment[]>([]);
  const canEdit = selected ? user.roleCode === "ADMIN" || selected.writerEmpId === user.empId : false;

  async function load() {
    const page = await api<PageResponse<Notice>>("/notices?size=20");
    setItems(page.content);
    const nextAttachments = await loadAttachmentPresence("NOTICE", page.content.map((item) => item.noticeId));
    setAttachments(nextAttachments);
  }

  async function loadDetail(id: number) {
    const detail = await api<Notice>(`/notices/${id}`);
    setSelected(detail);
    setForm({ title: detail.title, content: detail.content, pinned: detail.pinned });
    setMode("detail");
  }

  useEffect(() => {
    void load();
  }, []);

  function startCreate() {
    setSelected(null);
    setForm({ title: "", content: "", pinned: false });
    setPendingFiles([]);
    setMode("create");
  }

  function startEdit() {
    if (!selected || !canEdit) return;
    setForm({ title: selected.title, content: selected.content, pinned: selected.pinned });
    setPendingFiles([]);
    setMode("edit");
  }

  async function save() {
    const isEdit = mode === "edit" && selected && canEdit;
    const path = isEdit ? `/notices/${selected.noticeId}` : "/notices";
    const method = isEdit ? "PUT" : "POST";
    const saved = await api<Notice>(path, { method, body: jsonBody(form) });
    await uploadAttachments("NOTICE", saved.noticeId, pendingFiles);
    setPendingFiles([]);
    await load();
    await loadDetail(saved.noticeId);
  }

  async function remove() {
    if (!selected || !canEdit) return;
    await api(`/notices/${selected.noticeId}`, { method: "DELETE" });
    setSelected(null);
    setForm({ title: "", content: "", pinned: false });
    setPendingFiles([]);
    setMode("list");
    await load();
  }

  return (
    <section className="panel board-screen">
      <Toolbar title="공지사항" onNew={startCreate} onRefresh={load} />
      {mode === "list" && (
        <>
          <ListSummary count={items.length} text="등록된 공지" />
          {items.length ? (
            <ContentTable
              rows={items.map((item) => ({
                id: item.noticeId,
                pinned: item.pinned,
                title: item.title,
                writer: item.writerName,
                date: formatDate(item.createdAt),
                hasAttachment: !!attachments[item.noticeId],
                views: item.viewCount,
                onOpen: () => loadDetail(item.noticeId)
              }))}
            />
          ) : <Empty text="공지사항이 없습니다." />}
        </>
      )}
      {mode === "detail" && selected && (
        <DetailPage onBack={() => setMode("list")}>
          <ReadDetail
            title={selected.title}
            content={selected.content}
            meta={`${selected.writerName} · 조회 ${selected.viewCount} · ${formatDate(selected.createdAt)}`}
            badge={selected.pinned ? "상단 고정" : undefined}
            canEdit={canEdit}
            onEdit={startEdit}
            onDelete={remove}
          />
          <AttachmentBox targetType="NOTICE" targetId={selected.noticeId} />
        </DetailPage>
      )}
      {(mode === "create" || mode === "edit") && (
        <DetailPage onBack={() => selected ? setMode("detail") : setMode("list")}>
          <NoticeEditor
            title={mode === "create" ? "공지 작성" : "공지 수정"}
            form={form}
            setForm={setForm}
            pendingFiles={pendingFiles}
            setPendingFiles={setPendingFiles}
            onSave={save}
            onCancel={() => selected ? setMode("detail") : setMode("list")}
            onDelete={mode === "edit" && canEdit ? remove : undefined}
          />
          {mode === "edit" && selected && <AttachmentBox targetType="NOTICE" targetId={selected.noticeId} />}
        </DetailPage>
      )}
    </section>
  );
}

function BoardPage({ user }: { user: User }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState<number | null>(null);
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [selected, setSelected] = useState<BoardPost | null>(null);
  const [mode, setMode] = useState<ContentMode>("list");
  const [form, setForm] = useState<BoardForm>({ title: "", content: "", draft: false });
  const [attachments, setAttachments] = useState<AttachmentPresence>({});
  const [pendingFiles, setPendingFiles] = useState<DraftAttachment[]>([]);
  const canEdit = selected ? user.roleCode === "ADMIN" || selected.writerEmpId === user.empId : false;

  async function loadBoards() {
    const data = await api<Board[]>("/boards");
    setBoards(data);
    if (!boardId || !data.some((board) => board.boardId === boardId)) {
      setBoardId(data[0]?.boardId ?? null);
    }
  }

  async function loadPosts(id = boardId) {
    if (!id) return;
    const page = await api<PageResponse<BoardPost>>(`/boards/${id}/posts?size=20`);
    setPosts(page.content);
    const nextAttachments = await loadAttachmentPresence("BOARD_POST", page.content.map((post) => post.postId));
    setAttachments(nextAttachments);
  }

  async function loadPost(id: number) {
    const detail = await api<BoardPost>(`/boards/posts/${id}`);
    setSelected(detail);
    setForm({ title: detail.title, content: detail.content, draft: detail.draft });
    setMode("detail");
  }

  useEffect(() => {
    void loadBoards();
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [boardId]);

  function changeBoard(nextBoardId: number) {
    setBoardId(nextBoardId);
    setSelected(null);
    setForm({ title: "", content: "", draft: false });
    setPendingFiles([]);
    setMode("list");
  }

  function startCreate() {
    setSelected(null);
    setForm({ title: "", content: "", draft: false });
    setPendingFiles([]);
    setMode("create");
  }

  function startEdit() {
    if (!selected || !canEdit) return;
    setForm({ title: selected.title, content: selected.content, draft: selected.draft });
    setPendingFiles([]);
    setMode("edit");
  }

  async function save() {
    if (!boardId && !selected) return;
    const isEdit = mode === "edit" && selected && canEdit;
    const path = isEdit ? `/boards/posts/${selected.postId}` : `/boards/${boardId}/posts`;
    const method = isEdit ? "PUT" : "POST";
    const saved = await api<BoardPost>(path, { method, body: jsonBody(form) });
    await uploadAttachments("BOARD_POST", saved.postId, pendingFiles);
    setPendingFiles([]);
    await loadPosts(saved.boardId);
    await loadPost(saved.postId);
  }

  async function remove() {
    if (!selected || !canEdit) return;
    await api(`/boards/posts/${selected.postId}`, { method: "DELETE" });
    setSelected(null);
    setForm({ title: "", content: "", draft: false });
    setPendingFiles([]);
    setMode("list");
    await loadPosts();
  }

  async function comment(content: string) {
    if (!selected || !content.trim()) return;
    await api(`/boards/posts/${selected.postId}/comments`, { method: "POST", body: jsonBody({ content }) });
    await loadPost(selected.postId);
  }

  return (
    <section className="panel board-screen">
      <div className="board-tabs">
        {boards.map((board) => (
          <button key={board.boardId} className={boardId === board.boardId ? "active" : ""} onClick={() => changeBoard(board.boardId)}>
            {displayBoardName(board)}
          </button>
        ))}
      </div>
      <Toolbar title="게시글" onNew={startCreate} onRefresh={() => loadPosts()} />
      {mode === "list" && (
        <>
          <ListSummary count={posts.length} text="표시 중인 게시글" />
          {posts.length ? (
            <ContentTable
              rows={posts.map((post) => ({
                id: post.postId,
                pinned: post.draft,
                title: post.title,
                writer: post.writerName,
                date: formatDate(post.createdAt),
                hasAttachment: !!attachments[post.postId],
                views: post.viewCount,
                onOpen: () => loadPost(post.postId)
              }))}
              pinnedLabel="임시"
            />
          ) : <Empty text="게시글이 없습니다." />}
        </>
      )}
      {mode === "detail" && selected && (
        <DetailPage onBack={() => setMode("list")}>
          <ReadDetail
            title={selected.title}
            content={selected.content}
            meta={`${selected.writerName} · 조회 ${selected.viewCount} · ${formatDate(selected.createdAt)}`}
            badge={selected.draft ? "임시글" : undefined}
            canEdit={canEdit}
            onEdit={startEdit}
            onDelete={remove}
          />
          <AttachmentBox targetType="BOARD_POST" targetId={selected.postId} />
          <CommentBox comments={selected.comments} onSubmit={comment} />
        </DetailPage>
      )}
      {(mode === "create" || mode === "edit") && (
        <DetailPage onBack={() => selected ? setMode("detail") : setMode("list")}>
          <BoardEditor
            title={mode === "create" ? "게시글 작성" : "게시글 수정"}
            form={form}
            setForm={setForm}
            pendingFiles={pendingFiles}
            setPendingFiles={setPendingFiles}
            onSave={save}
            onCancel={() => selected ? setMode("detail") : setMode("list")}
            onDelete={mode === "edit" && canEdit ? remove : undefined}
          />
          {mode === "edit" && selected && <AttachmentBox targetType="BOARD_POST" targetId={selected.postId} />}
        </DetailPage>
      )}
    </section>
  );
}

function ApprovalPage({ user, launch }: { user: User; launch: ApprovalLaunch | null }) {
  const [box, setBox] = useState<ApprovalBox>(launch?.box ?? "pending");
  const [dashboardFilter, setDashboardFilter] = useState<ApprovalLaunch | null>(launch);
  const [items, setItems] = useState<ApprovalSummary[]>([]);
  const [retentionAudits, setRetentionAudits] = useState<AuditLog[]>([]);
  const [approvalBoxes, setApprovalBoxes] = useState<{ box: ApprovalBox; label: string }[]>(APPROVAL_BOXES);
  const [selected, setSelected] = useState<Approval | null>(null);
  const [equipmentProposal, setEquipmentProposal] = useState<EquipmentProposal | null>(null);
  const [equipmentProposalLoading, setEquipmentProposalLoading] = useState(false);
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
    const isPurchaseRequest = isPurchaseTemplateCode(templateCode);
    const peManagerId = productionEngineeringManagerId(employees);
    const purchaseReceiverEmpId = purchaseReceiverId(employees);
    try {
      const defaultLine = await api<ApprovalDefaultLineApi>(`/approval-default-lines/effective?templateCode=${encodeURIComponent(templateCode)}`);
      if (!defaultLine.steps.length) {
        if (isPurchaseRequest) {
          setForm((current) => ({ ...current, receiverEmpIds: purchaseReceiverEmpId ? [purchaseReceiverEmpId] : [] }));
          setDefaultLineMessage(purchaseReceiverEmpId ? "구매요구서 수신자는 임나영 대리로 자동 지정됩니다." : "구매팀 임나영 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
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
          receiverEmpIds: isPurchaseRequest ? (purchaseReceiverEmpId ? [purchaseReceiverEmpId] : defaultLineIds(defaultLine.steps, "RECEIVER")) : isEquipmentProposal ? (peManagerId ? [peManagerId] : []) : defaultLineIds(defaultLine.steps, "RECEIVER"),
          referenceEmpIds: defaultLineIds(defaultLine.steps, "REFERENCE"),
          readerEmpIds: defaultLineIds(defaultLine.steps, "READER")
        };
      });
      setDefaultLineMessage(isPurchaseRequest
        ? purchaseReceiverEmpId ? "구매요구서 수신자는 임나영 대리로 자동 지정됩니다." : "구매팀 임나영 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요."
        : isEquipmentProposal
        ? peManagerId ? "수신자는 생산기술팀장으로 자동 지정됩니다." : "생산기술팀장을 찾지 못했습니다. 관리자에게 생산기술팀장 계정을 확인해 주세요."
        : defaultLine.source === "TEMPLATE" ? "양식별 기본 결재선을 적용했습니다." : "개인 기본 결재선을 적용했습니다.");
    } catch {
      if (isPurchaseRequest) {
        setForm((current) => ({ ...current, receiverEmpIds: purchaseReceiverEmpId ? [purchaseReceiverEmpId] : [] }));
        setDefaultLineMessage(purchaseReceiverEmpId ? "구매요구서 수신자는 임나영 대리로 자동 지정됩니다." : "구매팀 임나영 대리 계정을 찾지 못했습니다. 수신자를 직접 지정해 주세요.");
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
    setBox(launch.box);
    setSelected(null);
    setMode("list");
    setItems([]);
    void load(launch.box, launch.dashboardFilter);
  }, [launch]);

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

  async function applyApprovalSearch(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await applyApprovalSearchValues(approvalSearch);
  }

  async function applyApprovalSearchValues(search: ApprovalSearchForm) {
    setApprovalError("");
    setDashboardFilter(null);
    setSelected(null);
    setMode("list");
    setItems([]);
    await load(box, null, search);
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
    const isEquipmentProposal = isEquipmentProposalTemplateCode(previewTemplate.code);
    const purchaseReceiverEmpId = purchaseReceiverId(employees);
    setForm({
      ...defaultApprovalForm([previewTemplate]),
      title: isPurchaseRequest || isEquipmentProposal ? "" : previewTemplate.name,
      fieldValues: isEquipmentProposal
        ? { requestDeptName: requesterDeptName }
        : isPurchaseRequest
          ? purchaseDefaultFieldValues(user, employees)
        : isLeaveRequest || isLeaveCancel
          ? leaveUsageFieldValues(leaveUsage)
          : {},
      receiverEmpIds: isPurchaseRequest && purchaseReceiverEmpId ? [purchaseReceiverEmpId] : isEquipmentProposal && peManagerId ? [peManagerId] : []
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
    const peManagerId = productionEngineeringManagerId(employees);
    const purchaseReceiverEmpId = purchaseReceiverId(employees);
    const receiverEmpIds = isPurchaseRequest && purchaseReceiverEmpId ? [purchaseReceiverEmpId] : isEquipmentProposal && peManagerId ? [peManagerId] : form.receiverEmpIds;
    const requesterDeptName = currentUserDeptName(user, employees, form.fieldValues.requestDeptName ?? "");
    const fieldValues = isEquipmentProposalTemplateCode(template.code)
      ? { ...form.fieldValues, requestDeptName: requesterDeptName }
      : isPurchaseRequest
        ? purchaseDefaultFieldValues(user, employees, form.fieldValues)
      : form.fieldValues;
    const content = isEquipmentProposalTemplateCode(template.code)
      ? equipmentProposalContent(fieldValues, template.code)
      : isLeaveRequest
        ? leaveRequestContent(fieldValues)
        : isLeaveCancel
          ? leaveCancelContent(fieldValues)
          : isPurchaseRequest
            ? purchaseRequestContent(fieldValues)
        : form.content;
    if (submit) {
      if ((isEquipmentProposalTemplateCode(template.code) || isPurchaseRequest) && !form.title.trim()) {
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
    const peManagerId = productionEngineeringManagerId(employees);
    const purchaseReceiverEmpId = purchaseReceiverId(employees);
    const requesterDeptName = currentUserDeptName(user, employees, form.fieldValues.requestDeptName ?? "");
    setForm({
      ...form,
      templateCode,
      templateVersion: nextTemplate.version ?? null,
      title: isPurchaseRequest || isEquipmentProposal ? "" : shouldUseTemplateTitle ? nextTemplate.name : form.title,
      fieldValues: isEquipmentProposal ? { requestDeptName: requesterDeptName } : isPurchaseRequest ? purchaseDefaultFieldValues(user, employees) : isLeaveRequest || isLeaveCancel ? leaveUsageFieldValues(leaveUsage) : {},
      receiverEmpIds: isPurchaseRequest && purchaseReceiverEmpId ? [purchaseReceiverEmpId] : isEquipmentProposal && peManagerId ? [peManagerId] : []
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
  const isEquipmentProposalForm = isEquipmentProposalTemplateCode(selectedTemplate.code);
  const restrictedIds = [...form.agreementEmpIds, ...form.approverEmpIds, ...form.receiverEmpIds];
  const peManagerEmployee = employees.find((employee) => employee.empId === productionEngineeringManagerId(employees));
  const permissions = selected?.permissions;
  const equipmentInputStage = equipmentProposal?.workflowStage === "PE_INPUT" || equipmentProposal?.workflowStage === "PURCHASE_INPUT";

  return (
    <section className="panel board-screen approval-screen">
      <div className="board-tabs approval-tabs">
        {approvalBoxes.map((tab) => (
          <button key={tab.box} className={mode !== "templates" && mode !== "delegation" && mode !== "operationSettings" && mode !== "deleted" && box === tab.box ? "active" : ""} onClick={() => void changeBox(tab.box)}>{tab.label}</button>
        ))}
        <button className={mode === "delegation" ? "active" : ""} onClick={() => void openDelegationSettings()}>대리설정</button>
        {isApprovalAdmin && <button className={mode === "templates" ? "active" : ""} onClick={() => void openTemplateAdmin()}>양식관리</button>}
        {isApprovalAdmin && <button className={mode === "operationSettings" ? "active" : ""} onClick={() => openOperationSettings()}>운영설정</button>}
        {isApprovalAdmin && <button className={mode === "deleted" ? "active" : ""} onClick={() => void openDeletedApprovals()}>보존삭제함</button>}
      </div>
      {mode !== "templates" && mode !== "delegation" && mode !== "operationSettings" && mode !== "deleted" && <Toolbar title={dashboardFilter ? `전자결재 · ${dashboardFilter.label}` : "전자결재"} onNew={startCreate} onRefresh={() => load(box)} />}
      {approvalError && <p className="error">{approvalError}</p>}
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
          <div className="approval-actions approval-actions-top">
          {permissions?.canEditDraft && <button onClick={editDraft}><Edit3 size={16} /> 수정</button>}
          {permissions?.canSubmit && selected.status !== "IN_PROGRESS" && <button onClick={() => { editDraft(); }}><Check size={16} /> 상신</button>}
          {permissions?.canApprove && !equipmentInputStage && <button className="primary-action" onClick={() => action("approve")}><Check size={16} /> 승인</button>}
          {permissions?.canReject && <button className="danger" onClick={() => action("reject")}><X size={16} /> 반려</button>}
          {permissions?.canWithdraw && <button className="ghost" onClick={withdraw}><RefreshCw size={16} /> 회수</button>}
          {permissions?.canRedraft && <button onClick={redraft}><Save size={16} /> 재상신</button>}
          {permissions?.canReceive && <button onClick={() => action("receive")}><Inbox size={16} /> 수신 확인</button>}
          {permissions?.canCompleteReceipt && <button onClick={() => action("complete-receipt")}><Check size={16} /> 접수완료</button>}
          {permissions?.canCancel && <button className="ghost" onClick={() => action("cancel")}><X size={16} /> 취소</button>}
          {permissions?.canPrintPdf && selected.pdfStatus === "GENERATED" && selected.pdfFileId != null && <button className="ghost" onClick={() => downloadApprovalPdf(selected.approvalId, selected.documentNo ?? selected.title)}><Paperclip size={16} /> PDF 출력</button>}
          {isApprovalAdmin && <button className="ghost" onClick={() => void correctStatus()}><RefreshCw size={16} /> 상태 보정</button>}
          {isApprovalAdmin && <button className="danger" onClick={() => void deleteForRetention()}><Trash2 size={16} /> 보존삭제</button>}
        </div>
        </div>
      )}
      {mode === "delegation" && (
        <div className="approval-template-editor">
          <div className="panel-head">
            <div>
              <h3>대리결재 설정</h3>
              <p className="muted-text">지정 기간 동안 대리자가 내 합의/결재 대기 문서를 처리할 수 있습니다.</p>
            </div>
            <div className="actions">
              <button type="button" onClick={() => void saveDelegation()}><Save size={16} /> 저장</button>
              {delegation && <button type="button" className="ghost" onClick={() => void deleteDelegation()}><X size={16} /> 해제</button>}
            </div>
          </div>
          {delegationMessage && <p className="template-note"><span>{delegationMessage}</span></p>}
          {delegation && (
            <div className="template-note">
              <strong>{delegation.activeNow ? "현재 적용 중" : "현재 미적용"}</strong>
              <span>{delegation.delegateName} · {delegation.startDate} ~ {delegation.endDate ?? "종료일 없음"}</span>
            </div>
          )}
          <div className="template-form">
            <label>시작일<input type="date" value={delegationForm.startDate} onChange={(event) => setDelegationForm({ ...delegationForm, startDate: event.target.value })} /></label>
            <label>종료일<input type="date" value={delegationForm.endDate} onChange={(event) => setDelegationForm({ ...delegationForm, endDate: event.target.value })} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={delegationForm.active} onChange={(event) => setDelegationForm({ ...delegationForm, active: event.target.checked })} /> 활성화</label>
            <label className="wide">사유<input value={delegationForm.reason} onChange={(event) => setDelegationForm({ ...delegationForm, reason: event.target.value })} placeholder="휴가, 출장 등" /></label>
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
          {dashboardFilter && (
            <div className="approval-filter-banner">
              <span>{dashboardFilter.label} 기준으로 표시 중</span>
              <button type="button" className="ghost" onClick={() => void changeBox(dashboardFilter.box)}>필터 해제</button>
            </div>
          )}
          <ListSummary count={items.length} text={`${approvalBoxes.find((item) => item.box === box)?.label ?? "문서"} 문서`} />
          {items.length ? <ApprovalListTable items={items} templates={templates} onOpen={loadDetail} /> : <Empty text="표시할 전자결재 문서가 없습니다." />}
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
            {isEquipmentProposalForm && <EquipmentProposalEditor user={user} employees={employees} form={form} onChange={setForm} />}
            {!isClassicDraftForm && !isLeaveRequestForm && !isLeaveCancelForm && !isPurchaseRequestForm && !isEquipmentProposalForm && (
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

function TemplateFieldInputs({
  fields,
  values,
  onChange
}: {
  fields: ApprovalTemplateField[];
  values: Record<string, string>;
  onChange: (name: string, value: string) => void;
}) {
  if (!fields.length) return null;
  return (
    <div className="template-field-grid">
      {fields.map((field) => {
        const required = isRequiredTemplateField(field);
        const label = required ? `${field.label} *` : field.label;
        if (field.type === "textarea") {
          return (
            <label key={field.name} className="wide">{label}
              <textarea value={values[field.name] ?? ""} onChange={(event) => onChange(field.name, event.target.value)} />
            </label>
          );
        }
        if (field.type === "select") {
          return (
            <label key={field.name}>{label}
              <select value={values[field.name] ?? ""} onChange={(event) => onChange(field.name, event.target.value)}>
                <option value="">선택</option>
                {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          );
        }
        return (
          <label key={field.name}>{label}
            <input
              type={field.type === "date" || field.type === "number" ? field.type : "text"}
              value={values[field.name] ?? ""}
              onChange={(event) => onChange(field.name, event.target.value)}
            />
          </label>
        );
      })}
    </div>
  );
}

function PurchaseRequestEditor({ user, employees, form, onChange }: { user: User; employees: Employee[]; form: ApprovalForm; onChange: (form: ApprovalForm) => void }) {
  const values = purchaseDefaultFieldValues(user, employees, form.fieldValues);
  const items = parsePurchaseItems(values);
  const buTotal = purchaseBuTotal(values);

  function setField(name: string, value: string) {
    onChange({ ...form, fieldValues: { ...values, [name]: value } });
  }

  function setItem(index: number, name: keyof PurchaseRequestItem, value: string) {
    const nextItems = normalizePurchaseItems(items);
    nextItems[index] = { ...nextItems[index], [name]: value };
    onChange({ ...form, fieldValues: { ...values, purchaseItemsJson: purchaseItemsJson(nextItems) } });
  }

  function addItem() {
    onChange({ ...form, fieldValues: { ...values, purchaseItemsJson: purchaseItemsJson([...items, blankPurchaseItem()]) } });
  }

  function removeItem(index: number) {
    const nextItems = items.filter((_, itemIndex) => itemIndex !== index);
    onChange({ ...form, fieldValues: { ...values, purchaseItemsJson: purchaseItemsJson(nextItems.length ? nextItems : [blankPurchaseItem()]) } });
  }

  return (
    <div className="purchase-request-form">
      <div className="approval-form-grid">
        <label className="wide">{requiredLabel("문서 제목")}<input required value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="예: 구매요구서 - 안전장갑 외 3건 - 생산팀" /></label>
      </div>

      <div className="purchase-paper">
        <PurchaseDraftStampHeader user={user} employees={employees} form={form} />
        <div className="purchase-meta-grid">
          <label><span>부서명</span><input readOnly value={values.requestDeptName} /></label>
          <label><span>성명</span><input readOnly value={values.requesterName} /></label>
          <label><span>청구일</span><input readOnly type="date" value={values.requestDate} /></label>
          <label><span>{requiredLabel("요구일")}</span><input required type="date" value={values.requiredDate} onChange={(event) => setField("requiredDate", event.target.value)} /></label>
          <label><span>접수일</span><input readOnly value={values.receiptDate || "수신 확인 시 자동 기입"} /></label>
          <label><span>입고일</span><input readOnly value={values.deliveryDate || "구매부서 입력"} /></label>
        </div>

        <div className="purchase-items-head">
          <strong>품목 내역</strong>
          <button type="button" className="ghost" onClick={addItem}><Plus size={16} /> 행 추가</button>
        </div>
        <div className="purchase-item-table">
          <div className="purchase-item-row purchase-item-header">
            <span>품명</span><span>규격</span><span>수량</span><span>용도</span><span></span>
          </div>
          {items.map((item, index) => (
            <div className="purchase-item-row" key={index}>
              <input value={item.itemName} onChange={(event) => setItem(index, "itemName", event.target.value)} />
              <input value={item.spec} onChange={(event) => setItem(index, "spec", event.target.value)} />
              <input value={item.quantity} onChange={(event) => setItem(index, "quantity", event.target.value)} />
              <input value={item.usage} onChange={(event) => setItem(index, "usage", event.target.value)} />
              <button type="button" className="ghost danger" onClick={() => removeItem(index)} disabled={items.length === 1}><X size={15} /></button>
            </div>
          ))}
        </div>

        <div className="purchase-bu-section">
          <div className="purchase-items-head">
            <strong>BU 비용분할</strong>
            <span className={Math.abs(buTotal - 100) < 0.0001 ? "bu-total ok" : "bu-total"}>합계 {buTotal || 0}%</span>
          </div>
          <div className="purchase-bu-grid">
            {PURCHASE_BU_CODES.map((code) => (
              <label key={code}><span>{code}</span><input type="number" min="0" max="100" step="0.1" value={values[`bu_${code}`]} onChange={(event) => setField(`bu_${code}`, event.target.value)} /></label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaveRequestEditor({ mode, user, employees, form, leaveUsage, onChange }: { mode: "request" | "cancel"; user: User; employees: Employee[]; form: ApprovalForm; leaveUsage: LeaveUsage | null; onChange: (form: ApprovalForm) => void }) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const values = form.fieldValues;
  const selections = parseLeaveSelections(values);
  const cancelMode = mode === "cancel";
  const deptName = currentUserDeptName(user, employees, user.deptName ?? "");
  const requester = employees.find((employee) => employee.empId === user.empId);
  const annualDays = formatDayValue(values.days);
  const usedBefore = formatDayValue(leaveUsage?.usedAnnualDays ?? values.usedAnnualDays ?? "0");
  const totalDays = formatDayValue(leaveUsage?.totalAnnualDays ?? values.totalAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS);
  const remainingDays = cancelMode
    ? formatDayValue(Number(totalDays) - Number(usedBefore) + Number(annualDays))
    : remainingAnnualDaysText(totalDays, usedBefore, annualDays);

  function updateValues(nextValues: Record<string, string>) {
    onChange({
      ...form,
      title: form.title.trim() ? form.title : cancelMode ? "휴가 취소계" : "휴가계",
      content: cancelMode ? leaveCancelContent(nextValues) : leaveRequestContent(nextValues),
      fieldValues: nextValues
    });
  }

  function applySelections(nextSelections: LeaveSelection[]) {
    const sorted = [...nextSelections].sort((a, b) => a.date.localeCompare(b.date));
    const days = sorted.reduce((sum, selection) => sum + selection.days, 0);
    const nextValues = {
      ...values,
      startDate: sorted[0]?.date ?? "",
      endDate: sorted[sorted.length - 1]?.date ?? "",
      days: formatDayValue(days),
      annualLeaveDays: formatDayValue(days),
      usedAnnualDays: usedBefore,
      totalAnnualDays: totalDays,
      remainingAnnualDays: cancelMode ? formatDayValue(Number(totalDays) - Number(usedBefore) + days) : remainingAnnualDaysText(totalDays, usedBefore, days),
      leaveType: leaveSummary(sorted),
      leaveSelectionsJson: JSON.stringify(sorted)
    };
    updateValues(nextValues);
  }

  return (
    <div className="leave-request-editor">
      <div className="leave-paper">
        <h2>{cancelMode ? "휴가 취소계" : "휴가계 (연차, 반차, 교육 등)"}</h2>
        <div className="leave-paper-top">
          <LeaveStamp title="결재" writer={user.empName} approvers={employeesByIds(employees, form.approverEmpIds)} />
          <LeaveStamp title="수신" writer="" approvers={employeesByIds(employees, form.receiverEmpIds)} />
        </div>
        <div className="leave-meta">
          <span>신청자 : {user.empName}</span>
          <span>TEL :</span>
          <span>기 타 :</span>
          <span>부 서 : {deptName || "-"}</span>
          <span>직 급 : {requester?.positionName ?? requester?.jobTitle ?? "-"}</span>
          <span>신청일 : {todayDate()}</span>
        </div>
        <div className="leave-form-table">
          <div className="leave-label">제 목</div>
          <input className="leave-title-input" value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="휴가계" />
          <button type="button" className="leave-label leave-clickable" onClick={() => setCalendarOpen(true)}>
            <CalendarDays size={16} /> {cancelMode ? "취소기간" : "신청기간"}
          </button>
          <button type="button" className="leave-value leave-clickable" onClick={() => setCalendarOpen(true)}>{leaveDateRangeText(values)}</button>
          <button type="button" className="leave-label leave-clickable" onClick={() => setCalendarOpen(true)}>
            <CalendarDays size={16} /> {cancelMode ? "취소구분" : "신청구분"}
          </button>
          <button type="button" className="leave-value leave-clickable leave-kind-value" onClick={() => setCalendarOpen(true)}>{values.leaveType || (cancelMode ? "최종 결재 완료된 휴가 날짜만 선택하세요." : "달력에서 날짜와 구분을 선택하세요.")}</button>
          <div className="leave-label leave-wide-label">신청 전 연차사용 일수 / 총 연차일수</div>
          <div className="leave-value leave-days-value">
            <span>{usedBefore}</span><span>/</span><span>{totalDays}</span><span>일</span>
          </div>
          <div className="leave-label">{cancelMode ? "취소 연차일수" : "연차 사용일수"}</div>
          <div className="leave-value">{annualDays} 일</div>
          <div className="leave-label">{cancelMode ? "취소 후 잔여 연차일수" : "신청 후 잔여 연차일수"}</div>
          <div className="leave-value">{remainingDays} 일</div>
        </div>
      </div>
      <p className="muted-text">{cancelMode ? "최종 결재 완료된 휴가 날짜만 선택할 수 있고, 취소계 승인 후 연차가 복구됩니다." : "제목은 휴가계로 표시하고, 계산되는 일수는 연차/오전반차/오후반차만 반영됩니다."}</p>
      {calendarOpen && (
        <LeaveCalendarModal
          mode={mode}
          selections={selections}
          lockedSelections={leaveUsage?.selections ?? []}
          onCancel={() => setCalendarOpen(false)}
          onConfirm={(nextSelections) => {
            applySelections(nextSelections);
            setCalendarOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LeaveStamp({ title, writer, approvers }: { title: string; writer: string; approvers: Employee[] }) {
  const columns = [
    ...(writer ? [{ label: "작성", name: writer, position: "신청자" }] : []),
    ...approvers.map((employee, index) => ({
      label: title === "수신" ? "수신" : index === approvers.length - 1 ? "승인" : "검토",
      name: employee.empName,
      position: employee.positionName ?? employee.jobTitle ?? ""
    }))
  ];
  if (!columns.length) columns.push({ label: "", name: "", position: "" });
  const columnWidth = "72px";
  const maxWidth = `${34 + columns.length * 72}px`;
  return (
    <div className={`leave-stamp ${title === "수신" ? "align-right" : "align-left"}`} style={{ gridTemplateColumns: `34px repeat(${columns.length}, ${columnWidth})`, maxWidth }}>
      <div className="leave-stamp-side">{title}</div>
      {columns.map((column, index) => <div key={`head-${index}`} className="leave-stamp-cell head">{column.label}</div>)}
      {columns.map((column, index) => (
        <div key={`body-${index}`} className="leave-stamp-cell body">
          <span>{column.position}</span>
          <strong>{column.name}</strong>
        </div>
      ))}
    </div>
  );
}

function LeaveCalendarModal({ mode, selections, lockedSelections, onCancel, onConfirm }: { mode: "request" | "cancel"; selections: LeaveSelection[]; lockedSelections: LeaveUsage["selections"]; onCancel: () => void; onConfirm: (selections: LeaveSelection[]) => void }) {
  const initialDate = selections[0]?.date ? new Date(`${selections[0].date}T00:00:00`) : new Date();
  const [visibleMonth, setVisibleMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [draftSelections, setDraftSelections] = useState<LeaveSelection[]>(selections);
  const selectedMap = new Map(draftSelections.map((selection) => [selection.date, selection]));
  const lockedMap = new Map(lockedSelections.map((selection) => [selection.date, selection]));
  const cancelMode = mode === "cancel";
  const monthCells = calendarCells(visibleMonth);
  const totalDays = draftSelections.reduce((sum, selection) => sum + selection.days, 0);

  function moveMonth(delta: number) {
    setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + delta, 1));
  }

  function toggleDate(date: string) {
    const approvedSelection = lockedMap.get(date);
    if (cancelMode && !approvedSelection) {
      return;
    }
    if (!cancelMode && lockedMap.has(date)) {
      return;
    }
    if (selectedMap.has(date)) {
      setDraftSelections(draftSelections.filter((selection) => selection.date !== date));
      return;
    }
    if (cancelMode && approvedSelection) {
      setDraftSelections([...draftSelections, { date, type: approvedSelection.type, days: Number(approvedSelection.days || 0) }].sort((a, b) => a.date.localeCompare(b.date)));
      return;
    }
    setDraftSelections([...draftSelections, { date, type: "연차", days: 1 }].sort((a, b) => a.date.localeCompare(b.date)));
  }

  function changeType(date: string, type: string) {
    setDraftSelections(draftSelections.map((selection) => selection.date === date ? { ...selection, type, days: leaveDayValue(type) } : selection));
  }

  return (
    <div className="modal-backdrop">
      <div className="leave-calendar-modal">
        <div className="modal-head">
          <h2>신청일 선택</h2>
          <div className="leave-calendar-head-actions">
            <button type="button" onClick={() => onConfirm(draftSelections)}>확인</button>
            <button type="button" className="ghost icon-button" onClick={onCancel} aria-label="닫기"><X size={18} /></button>
          </div>
        </div>
        <div className="leave-calendar-toolbar">
          <button type="button" className="ghost" onClick={() => moveMonth(-1)}>이전</button>
          <strong>{visibleMonth.getFullYear()}년 {visibleMonth.getMonth() + 1}월</strong>
          <button type="button" className="ghost" onClick={() => moveMonth(1)}>다음</button>
        </div>
        <div className="leave-calendar-grid">
          {["일", "월", "화", "수", "목", "금", "토"].map((day) => <div key={day} className="leave-calendar-week">{day}</div>)}
          {monthCells.map((cell) => {
            const selected = selectedMap.get(cell.date);
            const locked = lockedMap.get(cell.date);
            const unavailable = cancelMode && !locked;
            return (
              <button
                type="button"
                key={cell.date}
                className={`leave-calendar-day${cell.inMonth ? "" : " outside"}${cell.weekend ? " weekend" : ""}${cell.holidayName ? " holiday" : ""}${selected ? " selected" : ""}${!cancelMode && locked ? " locked" : ""}${unavailable ? " unavailable" : ""}`}
                onClick={() => toggleDate(cell.date)}
                disabled={Boolean(!cancelMode && locked) || unavailable}
              >
                <span>{cell.day}</span>
                {cell.holidayName && <em className="leave-calendar-holiday">{cell.holidayName}</em>}
                {cancelMode && locked && !selected && <strong className="leave-calendar-locked-type">{locked.type}</strong>}
                {!cancelMode && locked && <strong className="leave-calendar-locked-type">{locked.type}</strong>}
                {selected && cancelMode && <strong className="leave-calendar-locked-type">{selected.type}</strong>}
                {selected && !cancelMode && (
                  <select
                    className="leave-calendar-type-select"
                    value={selected.type}
                    aria-label={`${cell.date} 신청구분`}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => changeType(cell.date, event.target.value)}
                  >
                    {LEAVE_TYPE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                )}
              </button>
            );
          })}
        </div>
        <div className="leave-selection-list">
          <div className="leave-selection-summary">선택 {draftSelections.length}일 · {cancelMode ? "취소 연차" : "연차 사용"} {formatDayValue(totalDays)}일</div>
          {lockedSelections.length > 0 && <p className="leave-locked-summary">결재 완료 {lockedSelections.length}일 · 이미 사용 {formatDayValue(lockedSelections.reduce((sum, selection) => sum + Number(selection.days || 0), 0))}일</p>}
          {draftSelections.length ? (
            <p className="leave-selection-inline-summary">{draftSelections.map((selection) => `${selection.date} ${selection.type}(${formatDayValue(selection.days)}일)`).join(", ")}</p>
          ) : <p className="muted-text">{cancelMode ? "최종 결재 완료된 휴가 날짜만 선택할 수 있습니다." : "달력에서 신청일을 선택하세요."}</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>취소</button>
          <button type="button" onClick={() => onConfirm(draftSelections)}>확인</button>
        </div>
      </div>
    </div>
  );
}

function calendarCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const current = new Date(start);
    current.setDate(start.getDate() + index);
    const date = localDateKey(current);
    const day = current.getDay();
    return {
      date,
      day: current.getDate(),
      inMonth: current.getMonth() === month.getMonth(),
      weekend: day === 0 || day === 6,
      holidayName: KOREAN_PUBLIC_HOLIDAYS[date] ?? ""
    };
  });
}

function LeaveRequestDetailView({ approval }: { approval: Approval }) {
  const values = approvalDraftData(approval).fieldValues;
  const cancelMode = isLeaveCancelTemplateCode(approval.templateCode);
  const approvers = approval.lines.filter((line) => line.lineType === "APPROVAL").sort((a, b) => a.lineOrder - b.lineOrder);
  const receivers = approval.lines.filter((line) => line.lineType === "RECEIVER").sort((a, b) => a.lineOrder - b.lineOrder);
  const usedBefore = formatDayValue(values.usedAnnualDays ?? "0");
  const totalDays = formatDayValue(values.totalAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS);
  const remainingDays = formatDayValue(values.remainingAnnualDays ?? (cancelMode ? Number(totalDays) - Number(usedBefore) + Number(values.days ?? 0) : remainingAnnualDaysText(totalDays, usedBefore, values.days)));

  return (
    <article className="leave-request-detail">
      <div className="leave-paper">
        <h2>{cancelMode ? "휴가 취소계" : "휴가계 (연차, 반차, 교육 등)"}</h2>
        <div className="leave-paper-top">
          <LeaveDetailStamp title="결재" writerName={approval.requesterName} writerPosition={approval.requesterPositionName ?? "신청자"} lines={approvers} />
          <LeaveDetailStamp title="수신" writerName="" writerPosition="" lines={receivers} />
        </div>
        <div className="leave-meta">
          <span>신청자 : {approval.requesterName}</span>
          <span>TEL :</span>
          <span>기 타 :</span>
          <span>부 서 : {approval.draftDeptName ?? approval.requesterDeptName ?? "-"}</span>
          <span>직 급 : {approval.requesterPositionName ?? "-"}</span>
          <span>신청일 : {formatDate(approval.requestedAt).slice(0, 10)}</span>
        </div>
        <div className="leave-form-table">
          <div className="leave-label">제 목</div><div className="leave-value">{approval.title}</div>
          <div className="leave-label">{cancelMode ? "취소기간" : "신청기간"}</div><div className="leave-value">{leaveDateRangeText(values)}</div>
          <div className="leave-label">{cancelMode ? "취소구분" : "신청구분"}</div><div className="leave-value leave-kind-value">{values.leaveType || "-"}</div>
          <div className="leave-label leave-wide-label">신청 전 연차사용 일수 / 총 연차일수</div>
          <div className="leave-value leave-days-value"><span>{usedBefore}</span><span>/</span><span>{totalDays}</span><span>일</span></div>
          <div className="leave-label">{cancelMode ? "취소 연차일수" : "연차 사용일수"}</div><div className="leave-value">{formatDayValue(values.days)} 일</div>
          <div className="leave-label">{cancelMode ? "취소 후 잔여 연차일수" : "신청 후 잔여 연차일수"}</div><div className="leave-value">{remainingDays} 일</div>
        </div>
      </div>
    </article>
  );
}

function LeaveDetailStamp({ title, writerName, writerPosition, lines }: { title: string; writerName: string; writerPosition: string; lines: ApprovalLine[] }) {
  const columns = [
    ...(writerName ? [{ label: "작성", name: writerName, position: writerPosition, date: "" }] : []),
    ...lines.map((line, index) => ({
      label: title === "수신" ? "수신" : index === lines.length - 1 ? "승인" : "검토",
      name: line.status === "APPROVED" || line.status === "REJECTED" ? lineStatusLabel(line.status) : line.approverName,
      position: line.positionSnapshot ?? line.approverPositionName ?? "결재자",
      date: line.signedAt ? formatDate(line.signedAt).slice(0, 10) : ""
    }))
  ];
  if (!columns.length) columns.push({ label: "", name: "", position: "", date: "" });
  const columnWidth = "72px";
  const maxWidth = `${34 + columns.length * 72}px`;
  return (
    <div className={`leave-stamp ${title === "수신" ? "align-right" : "align-left"}`} style={{ gridTemplateColumns: `34px repeat(${columns.length}, ${columnWidth})`, maxWidth }}>
      <div className="leave-stamp-side">{title}</div>
      {columns.map((column, index) => <div key={`head-${index}`} className="leave-stamp-cell head">{column.label}</div>)}
      {columns.map((column, index) => (
        <div key={`body-${index}`} className="leave-stamp-cell body">
          <span>{column.position}</span>
          <strong>{column.name}</strong>
          <small>{column.date}</small>
        </div>
      ))}
    </div>
  );
}

function EquipmentProposalEditor({ user, employees, form, onChange }: { user: User; employees: Employee[]; form: ApprovalForm; onChange: (form: ApprovalForm) => void }) {
  const requesterDeptName = currentUserDeptName(user, employees, form.fieldValues.requestDeptName ?? "");
  const proposalTitle = equipmentProposalTitle(form.templateCode);
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
    <article className="approval-template-editor equipment-proposal-editor equipment-proposal-detail">
      <section className="approval-detail-section">
        <h3>{proposalTitle}</h3>
        <div className="approval-form-grid">
          <label className="wide">{requiredLabel("문서 제목")}<input className={isAutoTitle ? "auto-title-input" : ""} required value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder={isMoldFixtureTemplateCode(form.templateCode) ? "예: S-BB123 제작 품의서" : "예: 가공기-1 개선 품의서"} /></label>
        </div>
      </section>
      {isMoldFixtureTemplateCode(form.templateCode) ? (
        <MoldFixtureProposalUserSection value={value} onChange={setValue} />
      ) : (
        <EquipmentProposalUserSection templateCode={form.templateCode} value={value} onChange={setValue} />
      )}
    </article>
  );
}

function EquipmentProposalUserSection({
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
    <section className="approval-detail-section">
      <div className="equipment-section-head">
        <h3>사용부서 작성란</h3>
        {stamp}
      </div>
      <div className="approval-form-grid">
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
        {!moldFixture && (
          <>
            <label>{requiredLabel(equipmentProposalItemLabel(templateCode))}<input required readOnly={readOnly} value={value("equipmentName")} onChange={change("equipmentName")} /></label>
            <label><span>{equipmentProposalCapacityLabel(templateCode)}</span><input readOnly={readOnly} value={value("equipmentCapacity")} onChange={change("equipmentCapacity")} /></label>
          </>
        )}
        <label>{requiredLabel("구분")}
          <select required disabled={readOnly} value={value("requestType")} onChange={change("requestType")}>
            <option value="">선택</option>
            {(moldFixture ? ["고객지급", "투자", "설계 및 제작", "구매", "수리", "매각", "폐기"] : ["구입", "제작", "개선", "수리", "매각", "폐기"]).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
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

function MoldFixtureProposalUserSection({
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
    <section className="approval-detail-section mold-fixture-section">
      <div className="equipment-section-head">
        <h3>사용부서 작성란</h3>
        {stamp}
      </div>
      <div className="mold-fixture-form">
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

function equipmentProposalContent(values: Record<string, string>, templateCode?: string | null) {
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

const APPROVAL_BOXES: { box: ApprovalBox; label: string }[] = [
  { box: "agreement", label: "합의대기" },
  { box: "pending", label: "결재대기" },
  { box: "received", label: "수신문서" },
  { box: "shared", label: "참조/연람" },
  { box: "requested", label: "기안문서" },
  { box: "processed", label: "처리문서" },
  { box: "all", label: "전체문서" }
];

function isApprovalBox(value: string): value is ApprovalBox {
  return APPROVAL_BOXES.some((item) => item.box === value);
}

function TemplateSelectModalV2({ templates, selected, fallbackActive, previewDeptName, previewRequesterName, onSelect, onCancel, onConfirm }: {
  templates: ApprovalTemplateOption[];
  selected: ApprovalTemplateOption;
  fallbackActive: boolean;
  previewDeptName: string;
  previewRequesterName: string;
  onSelect: (template: ApprovalTemplateOption) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => {
    const initial = categorizedTemplateGroups(templates).find((category) => category.templates.some((template) => template.code === selected.code));
    return initial?.id ?? APPROVAL_TEMPLATE_CATEGORIES[0].id;
  });
  const [keyword, setKeyword] = useState("");
  const groups = categorizedTemplateGroups(templates);
  const activeCategory = groups.find((category) => category.id === selectedCategoryId) ?? groups[0];
  const filteredTemplates = (activeCategory?.templates ?? []).filter((template) => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return true;
    return template.name.toLowerCase().includes(normalizedKeyword)
      || template.code.toLowerCase().includes(normalizedKeyword)
      || template.description.toLowerCase().includes(normalizedKeyword);
  });

  function selectCategory(category: ReturnType<typeof categorizedTemplateGroups>[number]) {
    setSelectedCategoryId(category.id);
    const firstMatched = category.templates.find((template) => template.code === selected.code) ?? category.templates[0];
    if (firstMatched) onSelect(firstMatched);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="template-select-modal template-select-modal-v2" role="dialog" aria-modal="true" aria-label="양식 선택">
        <div className="modal-head">
          <h3>양식선택</h3>
          <button type="button" className="icon-button" onClick={onCancel} title="닫기"><X size={18} /></button>
        </div>
        <div className="template-select-toolbar">
          <label>
            <span>양식명</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="검색어 입력" />
          </label>
          <button type="button" className="ghost" onClick={() => setKeyword("")}>초기화</button>
        </div>
        <div className="template-select-layout">
          <div className="template-category-list">
            <h3>양식함</h3>
            {fallbackActive && <p className="template-fallback-note">개발용 임시 목록</p>}
            {groups.map((category) => (
              <button type="button" key={category.id} className={activeCategory?.id === category.id ? "active" : ""} onClick={() => selectCategory(category)}>
                <span className="template-folder-icon" aria-hidden="true">▣</span>
                <strong>{category.label}</strong>
                <span>{category.templates.length}</span>
              </button>
            ))}
          </div>
          <div className="template-choice-panel">
            <div className="template-choice-list">
              <h3>양식리스트</h3>
              {filteredTemplates.length ? filteredTemplates.map((template) => (
                <button type="button" key={template.code} className={selected.code === template.code ? "active" : ""} onClick={() => onSelect(template)}>
                  <strong>{template.name}</strong>
                  <span>{template.code} v{template.version ?? 1}</span>
                </button>
              )) : <Empty text="표시할 양식이 없습니다." />}
              <div className="template-description-box">
                <strong>양식설명</strong>
                <span>{selected.description || "등록된 설명이 없습니다."}</span>
              </div>
            </div>
            <div className="template-preview">
              <h3>양식 미리보기</h3>
              <TemplatePaperPreview template={selected} previewDeptName={previewDeptName} previewRequesterName={previewRequesterName} />
              {!isPurchaseTemplateCode(selected.code) && <div className="paper-preview legacy-template-summary">
                <h2>{selected.name} - 기안자명</h2>
                <div className="preview-grid">
                  <strong>기안부서</strong><span>{previewDeptName}</span>
                  <strong>기안자</strong><span>{previewRequesterName}</span>
                  <strong>문서번호</strong><span>상신 시 자동생성</span>
                  <strong>결재</strong><span>합의/결재자 표시</span>
                </div>
              </div>}
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>취소</button>
          <button type="button" onClick={onConfirm} disabled={!selected}>확인</button>
        </div>
      </div>
    </div>
  );
}

function TemplateSelectModal({ templates, selected, fallbackActive, previewDeptName, previewRequesterName, onSelect, onCancel, onConfirm }: {
  templates: ApprovalTemplateOption[];
  selected: ApprovalTemplateOption;
  fallbackActive: boolean;
  previewDeptName: string;
  previewRequesterName: string;
  onSelect: (template: ApprovalTemplateOption) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div className="template-select-modal" role="dialog" aria-modal="true" aria-label="양식 선택">
        <div className="modal-head">
          <h3>양식 선택</h3>
          <button type="button" className="icon-button" onClick={onCancel} title="닫기"><X size={18} /></button>
        </div>
        <div className="template-select-layout">
          <div className="template-list">
            <h3>결재 양식 카테고리</h3>
            {fallbackActive && <p className="template-fallback-note">개발용 임시 목록</p>}
            {templates.map((template) => (
              <button type="button" key={template.code} className={selected.code === template.code ? "active" : ""} onClick={() => onSelect(template)}>
                <strong>{template.name}</strong>
                <span>{template.code} v{template.version ?? 1}</span>
              </button>
            ))}
          </div>
          <div className="template-preview">
            <h3>양식 미리보기</h3>
            <p>{selected.description || "등록된 설명이 없습니다."}</p>
            <TemplatePaperPreview template={selected} previewDeptName={previewDeptName} previewRequesterName={previewRequesterName} />
            {!isPurchaseTemplateCode(selected.code) && <div className="paper-preview legacy-template-summary">
              <h2>{selected.name} - 기안자명</h2>
              <div className="preview-grid">
                <strong>기안부서</strong><span>{previewDeptName}</span>
                <strong>기안자</strong><span>{previewRequesterName}</span>
                <strong>문서번호</strong><span>상신 시 자동생성</span>
                <strong>결재</strong><span>합의/결재선 표시</span>
              </div>
            </div>}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>취소</button>
          <button type="button" onClick={onConfirm}>확인</button>
        </div>
      </div>
    </div>
  );
}

function TemplatePaperPreview({ template, previewDeptName, previewRequesterName }: {
  template: ApprovalTemplateOption;
  previewDeptName: string;
  previewRequesterName: string;
}) {
  if (isPurchaseTemplateCode(template.code)) {
    return (
      <div className="template-paper template-purchase-preview">
        <div className="template-purchase-head">
          <TemplateMiniStamp label="결재" writer={previewRequesterName} />
          <h2>구매요구서</h2>
          <TemplateMiniStamp label="수신" writer="임나영" compact />
        </div>
        <div className="template-purchase-meta">
          <strong>부서명</strong><span>{previewDeptName}</span>
          <strong>성명</strong><span>{previewRequesterName}</span>
          <strong>청구일</strong><span>{todayDate()}</span>
          <strong>요구일</strong><span>작성자 입력</span>
          <strong>접수일</strong><span>수신 확인 시 자동 기입</span>
          <strong>입고일</strong><span>구매부서 입력</span>
          <strong>제목</strong><span className="wide">예: 구매요구서 - 안전장갑 외 3건 - 생산팀</span>
        </div>
        <div className="template-purchase-items">
          <span>품명</span><span>규격</span><span>수량</span><span>용도</span>
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span>
        </div>
        <div className="template-purchase-bu-title">BU 비용분할 <b>합계 100%</b></div>
        <div className="template-purchase-bu">
          {PURCHASE_BU_CODES.map((code) => <span key={code}>{code}<br />%</span>)}
        </div>
        <div className="template-attachment">첨부&nbsp;&nbsp; 견적서 / 사양서 / 참고자료</div>
      </div>
    );
  }

  if (isLeaveTemplateCode(template.code) || isLeaveCancelTemplateCode(template.code)) {
    const cancelMode = isLeaveCancelTemplateCode(template.code);
    return (
      <div className="template-paper template-leave-preview">
        <h2>{cancelMode ? "휴가 취소계" : "휴가계 (연차, 반차, 교육 등)"}</h2>
        <div className="template-leave-stamps">
          <TemplateMiniStamp label="결재" writer={previewRequesterName} />
          <TemplateMiniStamp label="수신" writer="" />
        </div>
        <div className="template-leave-meta">
          <span>신청자 : {previewRequesterName}</span>
          <span>TEL :</span>
          <span>기 타 :</span>
          <span>부 서 : {previewDeptName}</span>
          <span>직 급 :</span>
          <span>신청일 : {todayDate()}</span>
        </div>
        <div className="template-leave-table">
          <strong>제 목</strong><span>{cancelMode ? "휴가 취소계" : "휴가계"} - {previewRequesterName}</span>
          <strong>{cancelMode ? "취소기간" : "신청기간"}</strong><span>YYYY-MM-DD ~ YYYY-MM-DD [ 0 일 ]</span>
          <strong>{cancelMode ? "취소구분" : "신청구분"}</strong><span>{cancelMode ? "최종 결재 완료된 휴가 날짜 선택" : "달력에서 날짜와 구분 선택"}</span>
          <strong>신청 전 연차사용 일수 / 총 연차일수</strong><span>0 / {DEFAULT_TOTAL_ANNUAL_DAYS} 일</span>
          <strong>신청 후 잔여 연차일수</strong><span>{DEFAULT_TOTAL_ANNUAL_DAYS} 일</span>
        </div>
      </div>
    );
  }

  if (isMoldFixtureTemplateCode(template.code)) {
    return (
      <div className="template-paper template-equipment-preview template-mold-preview">
        <div className="template-equipment-top">
          <TemplateMiniStamp label="사용부서" writer={previewRequesterName} />
          <div className="template-equipment-title">
            <strong>금형 치공구 품의서</strong>
            <span>작성일자: {todayDate()}</span>
          </div>
          <TemplateMiniStamp label="주관부서" writer="" />
        </div>
        <div className="template-mold-info">
          <strong>품목</strong><span>□ 금형&nbsp;&nbsp; □ 치공구</span>
          <strong>사용부서</strong><span>{previewDeptName}</span>
          <strong>제품(기종)명</strong><span></span>
          <strong>제작유형</strong><span>□ 고객지급&nbsp;&nbsp; □ 투자&nbsp;&nbsp; □ 설계 및 제작&nbsp;&nbsp; □ 구매&nbsp;&nbsp; □ 수리</span>
          <strong>사유</strong><span className="large"></span>
        </div>
        <div className="template-mold-parts">
          <strong>부품 정보</strong>
          <span>부품명</span><span>CAVITY</span><span>재질</span><span>수량</span><span>금형번호</span>
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div className="template-equipment-body">
          <div>요구사항</div><div>지시사항</div>
          <div>설계 의견</div><div>구매 의견</div>
        </div>
        <div className="template-attachment">첨부&nbsp;&nbsp; □ 분말금형기초자료&nbsp;&nbsp; □ 제품도면&nbsp;&nbsp; □ 부품도면&nbsp;&nbsp; □ 견적서</div>
      </div>
    );
  }

  if (isEquipmentProposalTemplateCode(template.code)) {
    const title = equipmentProposalTitle(template.code);
    return (
      <div className="template-paper template-equipment-preview">
        <div className="template-equipment-top">
          <TemplateMiniStamp label="사용부서" writer={previewRequesterName} />
          <div className="template-equipment-title">
            <strong>{title}</strong>
            <span>작성일 : {todayDate()}</span>
          </div>
          <TemplateMiniStamp label="주관부서" writer="" />
        </div>
        <div className="template-equipment-info">
          <strong>요청부서</strong><span>{previewDeptName}</span>
          <strong>완료요구일</strong><span></span>
          <strong className="type-label">구분</strong><span className="type-options">□구입 □제작 □개선<br />□수리 □매각 □폐기</span>
          <strong>{equipmentProposalItemLabel(template.code)}</strong><span></span>
          <strong>{equipmentProposalCapacityLabel(template.code)}</strong><span></span>
        </div>
        <div className="template-equipment-body">
          <div>현상</div><div>주관부서(PE) 의견</div>
          <div>요구사항</div><div>설계 의견</div>
          <div>지시 사항</div><div>구매 의견</div>
        </div>
        <div className="template-economic">
          <strong>경제성 검토</strong>
          <span>사용부서</span>
          <span>주관 부서</span>
        </div>
        <div className="template-attachment">첨부&nbsp;&nbsp; □ 계약서&nbsp;&nbsp; □ 견적서&nbsp;&nbsp; □ 도면&nbsp;&nbsp; □ 설비사양서</div>
      </div>
    );
  }

  return (
    <div className="template-paper template-draft-preview">
      <div className="template-draft-logo-wrap">
        <img src={schunkLogo} alt="SCHUNK" />
      </div>
      <h2>{template.name}</h2>
      <div className="template-draft-head">
        <div className="template-draft-info">
          <strong>문서번호</strong><span>상신 후 자동생성</span>
          <strong>기안부서(자)</strong><span>{previewDeptName} / {previewRequesterName}</span>
          <strong>기안일자</strong><span>{todayDate()}</span>
          <strong>제목</strong><span>{template.name}</span>
        </div>
        <div className="template-draft-stamp">
          <div>작성</div><div>검토</div><div>승인</div>
          <div>{previewRequesterName}</div><div></div><div></div>
        </div>
      </div>
      <div className="template-draft-body">본문</div>
      <div className="template-draft-footer">
        <span>수신</span><span>참조</span><span>열람</span><span>상태</span>
      </div>
    </div>
  );
}

function TemplateMiniStamp({ label, writer, compact = false }: { label: string; writer: string; compact?: boolean }) {
  return (
    <div className={`template-mini-stamp${compact ? " compact" : ""}`}>
      <div className="stamp-side">{label}</div>
      <div className="stamp-cell">작성</div>
      {!compact && <div className="stamp-cell">검토</div>}
      {!compact && <div className="stamp-cell">승인</div>}
      <div className="stamp-name">{writer}</div>
      {!compact && <div className="stamp-name"></div>}
      {!compact && <div className="stamp-name"></div>}
    </div>
  );
}

function ApprovalListTable({ items, templates, onOpen }: { items: ApprovalSummary[]; templates: ApprovalTemplateOption[]; onOpen: (id: number) => void }) {
  return (
    <div className="table-wrap">
      <table className="content-table approval-list-table">
        <thead>
          <tr>
            <th>문서번호</th>
            <th>중요도</th>
            <th>양식</th>
            <th>제목</th>
            <th>기안자</th>
            <th>현재 단계</th>
            <th>문서 상태</th>
            <th>작성일</th>
            <th>완료일</th>
            <th>진행률</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.approvalId}>
              <td>{item.documentNo ?? "상신 전"}</td>
              <td><span className={`priority priority-${item.priority.toLowerCase()}`}>{priorityLabel(item.priority)}</span></td>
              <td>{templateName(templates, item.templateCode)}</td>
              <td><button className="title-link" onClick={() => onOpen(item.approvalId)}>{item.title}</button></td>
              <td>{item.requesterName}</td>
              <td>{stageLabel(item.currentStage)}</td>
              <td>{statusLabel(item.status)}</td>
              <td>{formatDate(item.requestedAt)}</td>
              <td>{item.completedAt ? formatDate(item.completedAt) : "-"}</td>
              <td>{item.currentApproverName ? `결재 ${item.currentApproverName}` : stageLabel(item.currentStage)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeletedApprovalListTable({ items, templates, onRestore }: { items: ApprovalSummary[]; templates: ApprovalTemplateOption[]; onRestore: (id: number) => void }) {
  return (
    <div className="table-wrap">
      <table className="content-table approval-list-table">
        <thead>
          <tr>
            <th>문서번호</th>
            <th>양식</th>
            <th>제목</th>
            <th>기안자</th>
            <th>문서 상태</th>
            <th>삭제일</th>
            <th>삭제자</th>
            <th>복구</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.approvalId}>
              <td>{item.documentNo ?? "상신 전"}</td>
              <td>{templateName(templates, item.templateCode)}</td>
              <td>{item.title}</td>
              <td>{item.requesterName}</td>
              <td>{statusLabel(item.status)}</td>
              <td>{item.deletedAt ? formatDate(item.deletedAt) : "-"}</td>
              <td>{item.deletedByName ?? "-"}</td>
              <td><button type="button" className="ghost" onClick={() => onRestore(item.approvalId)}><RefreshCw size={16} /> 복구</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApprovalRetentionAuditTable({ items }: { items: AuditLog[] }) {
  return (
    <div className="table-wrap">
      <table className="content-table approval-list-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>작업</th>
            <th>문서</th>
            <th>사용자</th>
            <th>사유</th>
            <th>결과</th>
            <th>IP</th>
            <th>일시</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.auditId}>
              <td>{item.auditId}</td>
              <td>{retentionAuditActionLabel(item.actionType)}</td>
              <td>#{item.targetId ?? "-"}</td>
              <td>{item.empId ?? "-"}</td>
              <td>{item.reason ?? "-"}</td>
              <td>{item.success ? "성공" : "실패"}</td>
              <td>{item.ipAddress ?? "-"}</td>
              <td>{formatDate(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApprovalDetailView({
  user,
  approval,
  templates,
  equipmentProposal,
  equipmentProposalLoading = false,
  employees = [],
  onSavePurchaseDeliveryDate,
  onSubmitPurchaseApprovalLine,
  onSaveEquipment,
  onSubmitEquipmentStage,
  onAssignEquipmentAssignee
}: {
  user: User;
  approval: Approval;
  templates: ApprovalTemplateOption[];
  equipmentProposal?: EquipmentProposal | null;
  equipmentProposalLoading?: boolean;
  employees?: Employee[];
  onSavePurchaseDeliveryDate?: (deliveryDate: string) => void;
  onSubmitPurchaseApprovalLine?: (agreementEmpIds: number[], approverEmpIds: number[]) => void;
  onSaveEquipment?: (next: Partial<EquipmentProposal>) => void;
  onSubmitEquipmentStage?: (stage: "pe" | "purchase", next: Partial<EquipmentProposal>) => void;
  onAssignEquipmentAssignee?: (type: "pe" | "purchase", empId: number) => void;
}) {
  if (isDraftTemplateCode(approval.templateCode)) {
    return <ClassicDraftDetailView approval={approval} templates={templates} />;
  }
  if (isLeaveTemplateCode(approval.templateCode) || isLeaveCancelTemplateCode(approval.templateCode)) {
    return <LeaveRequestDetailView approval={approval} />;
  }
  if (isPurchaseTemplateCode(approval.templateCode)) {
    return <PurchaseRequestDetailView user={user} employees={employees} approval={approval} onSaveDeliveryDate={onSavePurchaseDeliveryDate} onSubmitPurchaseApprovalLine={onSubmitPurchaseApprovalLine} />;
  }
  if (isEquipmentProposalTemplateCode(approval.templateCode) && equipmentProposal) {
    return (
      <EquipmentProposalDetailView
        user={user}
        approval={approval}
        equipmentProposal={equipmentProposal}
        employees={employees}
        onSave={onSaveEquipment}
        onSubmitStage={onSubmitEquipmentStage}
        onAssign={onAssignEquipmentAssignee}
      />
    );
  }
  if (isEquipmentProposalTemplateCode(approval.templateCode)) {
    const title = equipmentProposalTitle(approval.templateCode);
    return (
      <article className="approval-detail equipment-proposal-detail">
        <section className="approval-detail-section">
          <h3>{title}</h3>
          <p className="muted-text">{equipmentProposalLoading ? `${title} 양식을 불러오는 중입니다.` : `${title} 양식을 불러오지 못했습니다. 새로고침 후 다시 확인해 주세요.`}</p>
        </section>
      </article>
    );
  }

  return (
    <article className="approval-detail">
      <section className="approval-detail-section">
        <h3>문서 기본정보</h3>
        <dl className="approval-meta-grid">
          <dt>문서번호</dt><dd>{approval.documentNo ?? "상신 시 자동 생성"}</dd>
          <dt>양식</dt><dd>{templateName(templates, approval.templateCode)} v{approval.templateVersion ?? "-"}</dd>
          <dt>중요도</dt><dd>{priorityLabel(approval.priority)}</dd>
          <dt>현재 단계</dt><dd>{stageLabel(approval.currentStage)}</dd>
          <dt>문서 상태</dt><dd>{statusLabel(approval.status)}</dd>
          <dt>수신 상태</dt><dd>{receiverProgress(approval.lines)}</dd>
          <dt>기안자</dt><dd>{approval.requesterName}</dd>
          <dt>기안부서</dt><dd>{approval.draftDeptName ?? approval.requesterDeptName ?? "-"}</dd>
          <dt>작성일</dt><dd>{formatDate(approval.requestedAt)}</dd>
          <dt>상신일</dt><dd>{approval.lastSubmittedAt ? formatDate(approval.lastSubmittedAt) : "-"}</dd>
          <dt>완료일</dt><dd>{approval.completedAt ? formatDate(approval.completedAt) : "-"}</dd>
          <dt>진행률</dt><dd>{approvalProgress(approval.lines)}</dd>
        </dl>
      </section>
      <section className="approval-detail-section">
        <h3>문서 내용</h3>
        <div className="detail-content">{approvalContent(approval) ? <RichContent content={approvalContent(approval)} /> : "내용이 없습니다."}</div>
      </section>
      <ApprovalLineSection title="합의자" lines={approval.lines.filter((line) => line.lineType === "AGREEMENT")} />
      <ApprovalLineSection title="결재자" lines={approval.lines.filter((line) => line.lineType === "APPROVAL")} />
      <ApprovalLineSection title="수신자" lines={approval.lines.filter((line) => line.lineType === "RECEIVER")} />
      <ApprovalLineSection title="참조자" lines={approval.lines.filter((line) => line.lineType === "REFERENCE")} />
      <ApprovalLineSection title="연람자" lines={approval.lines.filter((line) => line.lineType === "READER")} />
      <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
      <section className="approval-detail-section">
        <h3>감사 이력</h3>
        <p className="muted-text">감사 로그는 관리자 감사 화면에서 문서 ID #{approval.approvalId} 기준으로 추적합니다.</p>
      </section>
    </article>
  );
}

function PurchaseRequestDetailView({
  user,
  employees,
  approval,
  onSaveDeliveryDate,
  onSubmitPurchaseApprovalLine
}: {
  user: User;
  employees: Employee[];
  approval: Approval;
  onSaveDeliveryDate?: (deliveryDate: string) => void;
  onSubmitPurchaseApprovalLine?: (agreementEmpIds: number[], approverEmpIds: number[]) => void;
}) {
  const draftData = approvalDraftData(approval);
  const fields: Record<string, string> = {
    ...draftData.fieldValues,
    requestDeptName: draftData.fieldValues.requestDeptName || approval.draftDeptName || approval.requesterDeptName || "",
    requesterName: draftData.fieldValues.requesterName || approval.requesterName,
    requestDate: draftData.fieldValues.requestDate || (approval.requestedAt ?? "").slice(0, 10),
    receiptDate: draftData.fieldValues.receiptDate || purchaseReceiptDate(approval.lines).slice(0, 10)
  };
  const items = parsePurchaseItems(fields).filter((item) => Object.values(item).some((value) => value.trim()));
  const receiverLine = approval.lines.find((line) => line.lineType === "RECEIVER" && (line.assignedEmpId ?? line.approverEmpId) === user.empId);
  const purchaseReceiverStage = approval.status === "IN_PROGRESS" && approval.currentStage === "RECEIVER_PROGRESS";
  const canEditDeliveryDate = (approval.status === "APPROVED" || purchaseReceiverStage) && !!receiverLine;
  const canSubmitPurchaseApproval = purchaseReceiverStage
    && !!receiverLine
    && (receiverLine.status === "RECEIVED" || receiverLine.status === "READ");
  const [deliveryDate, setDeliveryDate] = useState(fields.deliveryDate ?? "");
  const [purchaseAgreementEmpIds, setPurchaseAgreementEmpIds] = useState<number[]>([]);
  const [purchaseApproverEmpIds, setPurchaseApproverEmpIds] = useState<number[]>([]);

  useEffect(() => {
    setDeliveryDate(fields.deliveryDate ?? "");
  }, [approval.approvalId, fields.deliveryDate]);

  return (
    <article className="approval-detail purchase-request-detail">
      <section className="approval-detail-section">
        <h3>구매요구서</h3>
        <dl className="approval-meta-grid">
          <dt>문서번호</dt><dd>{approval.documentNo ?? "상신 후 자동 생성"}</dd>
          <dt>문서상태</dt><dd>{statusLabel(approval.status)}</dd>
          <dt>수신상태</dt><dd>{receiverProgress(approval.lines)}</dd>
          <dt>기안자</dt><dd>{approval.requesterName}</dd>
        </dl>
      </section>
      {canSubmitPurchaseApproval && (
        <section className="approval-detail-section purchase-approval-submit-section">
          <div className="panel-head">
            <div>
              <h3>구매팀 결재 상신</h3>
              <p className="muted-text">구매팀 내부 결재라인을 지정해 상신하면 해당 결재 완료 후 문서가 최종 완료됩니다.</p>
            </div>
            <button type="button" onClick={() => onSubmitPurchaseApprovalLine?.(purchaseAgreementEmpIds, purchaseApproverEmpIds)}><Check size={16} /> 구매팀 결재 상신</button>
          </div>
          <div className="line-picker-grid">
            <EmployeeMultiPicker
              title="구매팀 합의자"
              user={user}
              employees={employees}
              selectedIds={purchaseAgreementEmpIds}
              disabledIds={[user.empId, ...purchaseApproverEmpIds]}
              onChange={setPurchaseAgreementEmpIds}
            />
            <EmployeeMultiPicker
              title="구매팀 결재자"
              user={user}
              employees={employees}
              selectedIds={purchaseApproverEmpIds}
              disabledIds={[user.empId, ...purchaseAgreementEmpIds]}
              ordered
              onChange={setPurchaseApproverEmpIds}
            />
          </div>
        </section>
      )}
      <section className="purchase-paper read-only">
        <PurchaseApprovalStampHeader approval={approval} />
        <div className="purchase-meta-grid">
          <label><span>부서명</span><input readOnly value={fields.requestDeptName ?? ""} /></label>
          <label><span>성명</span><input readOnly value={fields.requesterName ?? ""} /></label>
          <label><span>청구일</span><input readOnly value={fields.requestDate ?? ""} /></label>
          <label><span>요구일</span><input readOnly value={fields.requiredDate ?? ""} /></label>
          <label><span>접수일</span><input readOnly value={fields.receiptDate || "-"} /></label>
          <label><span>입고일</span><input type="date" readOnly={!canEditDeliveryDate} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label>
        </div>
        {canEditDeliveryDate && (
          <div className="purchase-delivery-actions">
            <button type="button" onClick={() => onSaveDeliveryDate?.(deliveryDate)}><Save size={16} /> 입고일 저장</button>
          </div>
        )}
        <div className="purchase-item-table">
          <div className="purchase-item-row purchase-item-header">
            <span>품명</span><span>규격</span><span>수량</span><span>용도</span><span></span>
          </div>
          {(items.length ? items : [blankPurchaseItem()]).map((item, index) => (
            <div className="purchase-item-row" key={index}>
              <span>{item.itemName || "-"}</span>
              <span>{item.spec || "-"}</span>
              <span>{item.quantity || "-"}</span>
              <span>{item.usage || "-"}</span>
              <span></span>
            </div>
          ))}
        </div>
        <div className="purchase-bu-section">
          <div className="purchase-items-head"><strong>BU 비용분할</strong><span className="bu-total ok">합계 {purchaseBuTotal(fields)}%</span></div>
          <div className="purchase-bu-grid">
            {PURCHASE_BU_CODES.map((code) => (
              <label key={code}><span>{code}</span><input readOnly value={fields[`bu_${code}`] || "0"} /></label>
            ))}
          </div>
        </div>
      </section>
      <ApprovalLineSection title="합의자" lines={approval.lines.filter((line) => line.lineType === "AGREEMENT")} />
      <ApprovalLineSection title="결재자" lines={approval.lines.filter((line) => line.lineType === "APPROVAL")} />
      <ApprovalLineSection title="수신자" lines={approval.lines.filter((line) => line.lineType === "RECEIVER")} />
      <ApprovalLineSection title="참조자" lines={approval.lines.filter((line) => line.lineType === "REFERENCE")} />
      <ApprovalLineSection title="열람자" lines={approval.lines.filter((line) => line.lineType === "READER")} />
      <ApprovalOpinionList lines={approval.lines.filter((line) => line.lineType === "AGREEMENT" || line.lineType === "APPROVAL")} />
    </article>
  );
}

function ApprovalLineSection({ title, lines }: { title: string; lines: ApprovalLine[] }) {
  return (
    <section className="approval-detail-section">
      <h3>{title}</h3>
      {lines.length ? (
        <div className="approval-lines compact">
          {lines.slice().sort((a, b) => a.lineOrder - b.lineOrder).map((line, index) => (
            <div className="approval-line" key={line.lineId}>
              <strong>{index + 1}. {line.empNameSnapshot ?? line.approverName}</strong>
              <span>{line.deptNameSnapshot ?? line.approverDeptName ?? "-"} · {line.positionSnapshot ?? line.approverPositionName ?? "-"} · {lineStatusLabel(line.status)}</span>
              {lineDueText(line) && <span className="due-text">{lineDueText(line)}</span>}
              {delegatedActionText(line) && (
                <span className="delegated-action-text">
                  <b>대리 처리</b> {delegatedActionText(line)}
                </span>
              )}
              {line.comment && <p>{line.comment}</p>}
            </div>
          ))}
        </div>
      ) : <Empty text={`${title}가 없습니다.`} />}
    </section>
  );
}

function PurchaseDraftStampHeader({ user, employees, form }: { user: User; employees: Employee[]; form: ApprovalForm }) {
  const approvalColumns = [
    {
      key: "requester",
      position: "작성자",
      name: user.empName,
      date: "",
      muted: false,
      delegateText: null
    },
    ...employeesByIds(employees, form.approverEmpIds).map((employee) => ({
      key: `approver-${employee.empId}`,
      position: employee.positionName ?? "결재자",
      name: employee.empName,
      date: "",
      muted: false,
      delegateText: null
    }))
  ];
  const receiverColumns = employeesByIds(employees, form.receiverEmpIds).map((employee) => ({
    key: `receiver-${employee.empId}`,
    position: employee.positionName ?? "수신자",
    name: employee.empName,
    date: "",
    muted: false,
    delegateText: null
  }));

  return <PurchaseStampHeader approvalColumns={approvalColumns} receiverColumns={receiverColumns} />;
}

function PurchaseApprovalStampHeader({ approval }: { approval: Approval }) {
  const receiverLines = approval.lines
    .filter((line) => line.lineType === "RECEIVER")
    .slice()
    .sort((a, b) => a.lineOrder - b.lineOrder);
  const firstReceiverOrder = receiverLines[0]?.lineOrder ?? Number.POSITIVE_INFINITY;
  const lastReceiverOrder = receiverLines[receiverLines.length - 1]?.lineOrder ?? Number.NEGATIVE_INFINITY;
  const requesterApprovalLines = approval.lines
    .filter((line) => line.lineType === "APPROVAL" && line.lineOrder < firstReceiverOrder)
    .slice()
    .sort((a, b) => a.lineOrder - b.lineOrder);
  const receiverDecisionLines = approval.lines
    .filter((line) => (line.lineType === "AGREEMENT" || line.lineType === "APPROVAL") && line.lineOrder > lastReceiverOrder)
    .slice()
    .sort((a, b) => a.lineOrder - b.lineOrder);
  const approvalColumns = [
    {
      key: "requester",
      position: approval.requesterPositionName ?? "작성자",
      name: approval.requesterName,
      date: approval.requestedAt,
      muted: false,
      delegateText: null
    },
    ...requesterApprovalLines.map(purchaseDecisionStampColumn)
  ];
  const receiverColumns = receiverLines.map((line) => ({
      key: String(line.lineId),
      position: line.positionSnapshot ?? line.approverPositionName ?? "수신자",
      name: line.empNameSnapshot ?? line.approverName,
      date: line.readAt ?? line.actedAt,
      muted: !line.readAt && !line.actedAt,
      delegateText: delegatedActionText(line)
    }));
  const receiverApprovalColumns = receiverDecisionLines.map(purchaseDecisionStampColumn);

  return <PurchaseStampHeader approvalColumns={approvalColumns} receiverColumns={receiverColumns} receiverApprovalColumns={receiverApprovalColumns} />;
}

function purchaseDecisionStampColumn(line: ApprovalLine): StampDisplayColumn {
  return {
    key: String(line.lineId),
    position: line.positionSnapshot ?? line.approverPositionName ?? (line.lineType === "AGREEMENT" ? "합의자" : "결재자"),
    name: line.status === "APPROVED" || line.status === "REJECTED" ? signatureDisplayName(line) : line.empNameSnapshot ?? line.approverName,
    date: line.signedAt ?? line.actedAt,
    muted: line.status !== "APPROVED" && line.status !== "REJECTED",
    delegateText: delegatedActionText(line)
  };
}

function PurchaseStampHeader({
  approvalColumns,
  receiverColumns,
  receiverApprovalColumns = []
}: {
  approvalColumns: StampDisplayColumn[];
  receiverColumns: StampDisplayColumn[];
  receiverApprovalColumns?: StampDisplayColumn[];
}) {
  return (
    <div className="purchase-paper-stamp-head">
      <PurchaseStampTable label="결재" columns={approvalColumns} minCount={2} />
      <div className="purchase-paper-title">구매요구서</div>
      <div className="purchase-receiver-stamps">
        <PurchaseStampTable label="수신" columns={[...receiverColumns, ...receiverApprovalColumns]} minCount={1} />
      </div>
    </div>
  );
}

function PurchaseStampTable({ label, columns, minCount }: { label: string; columns: StampDisplayColumn[]; minCount: number }) {
  const visibleColumns = padStampColumns(columns, minCount);

  return (
    <div className="approval-stamp-wrap purchase-approval-stamp">
      <div className="approval-stamp-label">{label}</div>
      <div className="approval-stamp-table">
        {visibleColumns.map((column) => (
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

function EquipmentProposalDetailView({
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

type StampDisplayColumn = {
  key: string;
  header?: string;
  position: string;
  name: string;
  date: string | null | undefined;
  muted: boolean;
  delegateText: string | null;
};

function emptyStampColumn(key: string): StampDisplayColumn {
  return {
    key,
    header: "",
    position: "",
    name: "",
    date: null,
    muted: true,
    delegateText: null
  };
}

function padStampColumns(columns: StampDisplayColumn[], minCount = 2) {
  const padded = [...columns];
  while (padded.length < minCount) {
    padded.push(emptyStampColumn(`empty-${padded.length}`));
  }
  return withStampHeaders(padded);
}

function withStampHeaders(columns: StampDisplayColumn[]) {
  return columns.map((column, index) => ({
    ...column,
    header: index === 0 ? "작성" : index === columns.length - 1 ? "승인" : "검토"
  }));
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

function ClassicDraftEditor({
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

function ClassicDraftDetailView({ approval, templates }: { approval: Approval; templates: ApprovalTemplateOption[] }) {
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

function EmployeeMultiPicker({ title, user, employees, selectedIds, disabledIds, ordered = false, onChange }: {
  title: string;
  user: User;
  employees: Employee[];
  selectedIds: number[];
  disabledIds: number[];
  ordered?: boolean;
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<Employee[]>(employees);
  const [knownEmployees, setKnownEmployees] = useState<Employee[]>(employees);

  useEffect(() => {
    setCandidates(employees);
    setKnownEmployees((prev) => mergeEmployees(prev, employees));
  }, [employees]);

  async function openPicker() {
    setOpen(true);
    if (!tree.length) setTree(await api<DeptNode[]>("/depts/tree"));
    await search();
  }

  async function search(targetDeptId = activeDeptId) {
    const params = new URLSearchParams({ page: "0", size: "80", status: "ACTIVE" });
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (targetDeptId) params.set("deptId", String(targetDeptId));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    setCandidates(page.content);
    setKnownEmployees((prev) => mergeEmployees(prev, page.content));
  }

  async function selectDept(deptId: number) {
    setActiveDeptId(deptId);
    await search(deptId);
  }

  function add(employee: Employee) {
    if (selectedIds.includes(employee.empId)) {
      remove(employee.empId);
      return;
    }
    if (disabledIds.includes(employee.empId)) return;
    setKnownEmployees((prev) => mergeEmployees(prev, [employee]));
    onChange([...selectedIds, employee.empId]);
  }

  function remove(empId: number) {
    onChange(selectedIds.filter((id) => id !== empId));
  }

  function move(empId: number, direction: -1 | 1) {
    const index = selectedIds.indexOf(empId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div className="line-picker-card">
      <div className="panel-head">
        <h3>{title}</h3>
        <button type="button" onClick={openPicker}><Building2 size={16} /> 선택</button>
      </div>
      {selectedIds.length ? selectedIds.map((id, index) => {
        const employee = knownEmployees.find((item) => item.empId === id);
        return (
          <div className="selected-approver" key={id}>
            <strong>{ordered ? `${index + 1}. ` : ""}{employee?.empName ?? id}</strong>
            <span>{employee?.deptName ?? "-"} · {employee?.positionName ?? "-"}</span>
            <div>
              {ordered && <button type="button" onClick={() => move(id, -1)} disabled={index === 0}>위</button>}
              {ordered && <button type="button" onClick={() => move(id, 1)} disabled={index === selectedIds.length - 1}>아래</button>}
              <button type="button" onClick={() => remove(id)}>삭제</button>
            </div>
          </div>
        );
      }) : <Empty text={`${title}를 선택하세요.`} />}
      {open && (
        <div className="modal-backdrop" role="presentation">
          <div className="org-picker-modal" role="dialog" aria-modal="true" aria-label={`${title} 선택`}>
            <div className="modal-head">
              <h3>{title} 선택</h3>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} title="닫기"><X size={18} /></button>
            </div>
            <div className="org-picker-layout">
              <div className="org-picker-tree">{tree.map((node) => <DeptTree key={node.deptId} node={node} active={activeDeptId} onSelect={selectDept} />)}</div>
              <div className="org-picker-results">
                <div className="searchbar">
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 아이디, 사번 검색" />
                  <button type="button" onClick={() => search()}><Search size={16} /> 검색</button>
                </div>
                <div className="employee-result-list">
                  {candidates.map((employee) => {
                    const disabled = disabledIds.includes(employee.empId);
                    const selfBlocked = (title === "합의자" || title === "경유/협조" || title === "결재자") && employee.empId === user.empId;
                    return (
                      <button key={employee.empId} type="button" disabled={disabled || selfBlocked} className={selectedIds.includes(employee.empId) ? "active" : ""} onClick={() => add(employee)}>
                        <strong>{employee.empName}</strong>
                        <span>{employee.deptName ?? "-"} · {employee.positionName ?? employee.jobTitle ?? employee.roleCode}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="org-picker-selected">
                <h3>선택된 {title}</h3>
                {selectedIds.length ? selectedIds.map((id, index) => {
                  const employee = knownEmployees.find((item) => item.empId === id);
                  return <div className="selected-approver" key={id}><strong>{ordered ? `${index + 1}. ` : ""}{employee?.empName ?? id}</strong><span>{employee?.deptName ?? "-"}</span></div>;
                }) : <Empty text="선택된 직원이 없습니다." />}
                <button type="button" className="primary" onClick={() => setOpen(false)}>적용</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function downloadApprovalPdf(approvalId: number, fileName: string) {
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

function documentPrefix(templateCode: string | null | undefined) {
  if (templateCode === "LEAVE") return "LEV";
  if (templateCode === "LEAVE_CANCEL") return "LVC";
  if (templateCode === "PURCHASE") return "PUR";
  if (templateCode === "TRAINING_REQUEST" || templateCode === "TRAINING_REPORT") return "EDU";
  if (templateCode === "EQUIPMENT_PROPOSAL") return "EQP";
  if (templateCode === "MOLD_FIXTURE_PROPOSAL") return "MFP";
  return "APP";
}

function templateName(templates: ApprovalTemplateOption[], code: string | null) {
  return templates.find((template) => template.code === code)?.name ?? code ?? "-";
}

function priorityLabel(priority: ApprovalSummary["priority"]) {
  return priority === "URGENT" ? "긴급" : priority === "IMPORTANT" ? "중요" : "일반";
}

function statusLabel(status: ApprovalSummary["status"]) {
  const labels: Record<ApprovalSummary["status"], string> = {
    DRAFT: "임시저장",
    PENDING: "진행중",
    IN_PROGRESS: "진행중",
    APPROVED: "승인",
    REJECTED: "반려",
    WITHDRAWN: "회수",
    CANCELED: "취소"
  };
  return labels[status] ?? status;
}

function retentionAuditActionLabel(actionType: string) {
  if (actionType === "DELETE_APPROVAL") return "보존삭제";
  if (actionType === "RESTORE_APPROVAL") return "복구";
  return actionType;
}

function stageLabel(stage: ApprovalSummary["currentStage"]) {
  const labels: Record<ApprovalSummary["currentStage"], string> = {
    DRAFT: "임시저장",
    AGREEMENT_PROGRESS: "합의 진행",
    APPROVAL_PROGRESS: "결재 진행",
    RECEIVER_PROGRESS: "수신 전달",
    COMPLETED: "완료",
    REJECTED: "반려",
    WITHDRAWN: "회수",
    CANCELED: "취소"
  };
  return labels[stage] ?? stage;
}

function lineStatusLabel(status: ApprovalLine["status"]) {
  const labels: Record<ApprovalLine["status"], string> = {
    WAITING: "대기",
    PENDING: "처리대기",
    APPROVED: "승인",
    REJECTED: "반려",
    SKIPPED: "건너뜀",
    RECEIVED: "수신",
    READ: "열람",
    RECEIPT_COMPLETED: "접수완료"
  };
  return labels[status] ?? status;
}

function lineTypeLabel(lineType: ApprovalLine["lineType"]) {
  const labels: Record<ApprovalLine["lineType"], string> = {
    AGREEMENT: "합의",
    APPROVAL: "결재",
    RECEIVER: "수신",
    REFERENCE: "참조",
    READER: "연람"
  };
  return labels[lineType] ?? lineType;
}

function lineDueText(line: ApprovalLine) {
  if (!line.dueAt || line.status !== "PENDING") return null;
  const overdue = new Date(line.dueAt).getTime() < Date.now();
  return `${overdue ? "기한 초과" : "처리 기한"} ${formatDate(line.dueAt)}`;
}

function lineAssignedName(line: ApprovalLine) {
  return line.empNameSnapshot ?? line.approverName;
}

function lineActedName(line: ApprovalLine) {
  return line.actedEmpName ?? signatureDisplayName(line);
}

function isDelegatedAction(line: ApprovalLine) {
  if (!line.actedEmpId || !line.assignedEmpId || line.actedEmpId === line.assignedEmpId) return false;
  return line.status === "APPROVED" || line.status === "REJECTED" || line.status === "RECEIPT_COMPLETED";
}

function delegatedActionText(line: ApprovalLine) {
  if (!isDelegatedAction(line)) return null;
  return `${lineAssignedName(line)} 대리로 ${lineActedName(line)} 처리`;
}

function approvalProgress(lines: ApprovalLine[]) {
  const agreements = lines.filter((line) => line.lineType === "AGREEMENT");
  const approvals = lines.filter((line) => line.lineType === "APPROVAL");
  const agreed = agreements.filter((line) => line.status === "APPROVED").length;
  const approved = approvals.filter((line) => line.status === "APPROVED").length;
  if (agreements.length && agreed < agreements.length) return `합의 ${agreed}/${agreements.length} 완료`;
  if (approvals.length) return `결재 ${approved}/${approvals.length} 진행`;
  return "-";
}

function receiverProgress(lines: ApprovalLine[]) {
  const receivers = lines.filter((line) => line.lineType === "RECEIVER");
  if (!receivers.length) return "-";
  const completed = receivers.filter((line) => line.status === "RECEIPT_COMPLETED").length;
  const read = receivers.filter((line) => line.status === "READ").length;
  return completed ? `접수완료 ${completed}/${receivers.length}` : read ? `수신확인 ${read}/${receivers.length}` : "수신 미접수";
}

function ApproverPicker({ employees, selectedIds, onChange }: { employees: Employee[]; selectedIds: number[]; onChange: (ids: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<Employee[]>(employees);
  const [knownEmployees, setKnownEmployees] = useState<Employee[]>(employees);

  useEffect(() => {
    setCandidates(employees);
    setKnownEmployees((prev) => mergeEmployees(prev, employees));
  }, [employees]);

  async function openPicker() {
    setOpen(true);
    if (!tree.length) {
      const data = await api<DeptNode[]>("/depts/tree");
      setTree(data);
    }
    await search();
  }

  async function search(targetDeptId = activeDeptId) {
    const params = new URLSearchParams({ page: "0", size: "50", status: "ACTIVE" });
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (targetDeptId) params.set("deptId", String(targetDeptId));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    const next = page.content;
    setCandidates(next);
    setKnownEmployees((prev) => mergeEmployees(prev, next));
  }

  async function selectDept(deptId: number) {
    setActiveDeptId(deptId);
    await search(deptId);
  }

  function add(employee: Employee) {
    if (selectedIds.includes(employee.empId)) {
      remove(employee.empId);
      return;
    }
    setKnownEmployees((prev) => mergeEmployees(prev, [employee]));
    onChange([...selectedIds, employee.empId]);
  }

  function remove(empId: number) {
    onChange(selectedIds.filter((id) => id !== empId));
  }

  function move(empId: number, direction: -1 | 1) {
    const index = selectedIds.indexOf(empId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div className="approver-picker">
      <div className="panel-head">
        <h3>결재선</h3>
        <button type="button" onClick={openPicker}><Building2 size={16} /> 결재라인 구성</button>
      </div>
      {selectedIds.length ? (
        <div className="approval-path">
          {selectedIds.map((id, index) => {
            const employee = knownEmployees.find((item) => item.empId === id);
            return (
              <span key={id}>
                {index + 1}. {employee?.empName ?? id}
                <button type="button" onClick={() => move(id, -1)} disabled={index === 0}>↑</button>
                <button type="button" onClick={() => move(id, 1)} disabled={index === selectedIds.length - 1}>↓</button>
                <button type="button" onClick={() => remove(id)}>×</button>
              </span>
            );
          })}
        </div>
      ) : <Empty text="결재자를 순서대로 선택해 주세요." />}
      {open && (
        <div className="modal-backdrop" role="presentation">
          <div className="org-picker-modal" role="dialog" aria-modal="true" aria-label="결재라인 구성">
            <div className="modal-head">
              <h3>결재라인 구성</h3>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} title="닫기"><X size={18} /></button>
            </div>
            <div className="org-picker-layout">
              <div className="org-picker-tree">
                {tree.map((node) => <DeptTree key={node.deptId} node={node} active={activeDeptId} onSelect={selectDept} />)}
              </div>
              <div className="org-picker-results">
                <div className="searchbar">
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 아이디, 사번 검색" />
                  <button type="button" onClick={() => search()}><Search size={16} /> 검색</button>
                </div>
                <div className="employee-result-list">
                  {candidates.map((employee) => (
                    <button key={employee.empId} type="button" className={selectedIds.includes(employee.empId) ? "active" : ""} onClick={() => add(employee)}>
                      <strong>{employee.empName}</strong>
                      <span>{employee.deptName ?? "-"} · {employee.positionName ?? employee.jobTitle ?? employee.roleCode}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="org-picker-selected">
                <h3>선택된 결재선</h3>
                {selectedIds.length ? selectedIds.map((id, index) => {
                  const employee = knownEmployees.find((item) => item.empId === id);
                  return (
                    <div className="selected-approver" key={id}>
                      <strong>{index + 1}. {employee?.empName ?? id}</strong>
                      <span>{employee?.deptName ?? "-"}</span>
                      <div>
                        <button type="button" onClick={() => move(id, -1)} disabled={index === 0}>↑</button>
                        <button type="button" onClick={() => move(id, 1)} disabled={index === selectedIds.length - 1}>↓</button>
                        <button type="button" onClick={() => remove(id)}>삭제</button>
                      </div>
                    </div>
                  );
                }) : <Empty text="선택된 결재자가 없습니다." />}
                <button type="button" className="primary" onClick={() => setOpen(false)}>적용</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function mergeEmployees(current: Employee[], next: Employee[]) {
  const byId = new Map(current.map((employee) => [employee.empId, employee]));
  next.forEach((employee) => byId.set(employee.empId, employee));
  return Array.from(byId.values());
}

function ApprovalLineTableEditor({
  user,
  employees,
  selectedIds,
  slotCount,
  onSlotCountChange,
  onChange
}: {
  user: User;
  employees: Employee[];
  selectedIds: number[];
  slotCount: number;
  onSlotCountChange: (count: number) => void;
  onChange: (ids: number[]) => void;
}) {
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<Employee[]>(employees);
  const [knownEmployees, setKnownEmployees] = useState<Employee[]>(employees);
  const safeSlotCount = clampApprovalSlotCount(Math.max(slotCount, selectedIds.length + 1));
  const approverSlotCount = safeSlotCount - 1;

  useEffect(() => {
    setCandidates(employees);
    setKnownEmployees((prev) => mergeEmployees(prev, employees));
  }, [employees]);

  async function openPicker(slotIndex: number) {
    setOpenSlot(slotIndex);
    if (!tree.length) {
      const data = await api<DeptNode[]>("/depts/tree");
      setTree(data);
    }
    await search();
  }

  async function search(targetDeptId = activeDeptId) {
    const params = new URLSearchParams({ page: "0", size: "50", status: "ACTIVE" });
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (targetDeptId) params.set("deptId", String(targetDeptId));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    const next = page.content.filter((employee) => employee.empId !== user.empId);
    setCandidates(next);
    setKnownEmployees((prev) => mergeEmployees(prev, next));
  }

  async function selectDept(deptId: number) {
    setActiveDeptId(deptId);
    await search(deptId);
  }

  function assign(employee: Employee) {
    if (openSlot === null) return;
    if (selectedIds[openSlot] === employee.empId) {
      clearSlot(openSlot);
      setOpenSlot(null);
      return;
    }
    const next = selectedIds.filter((id, index) => id !== employee.empId || index === openSlot);
    next[openSlot] = employee.empId;
    setKnownEmployees((prev) => mergeEmployees(prev, [employee]));
    onChange(next.filter((id): id is number => typeof id === "number"));
    onSlotCountChange(clampApprovalSlotCount(Math.max(safeSlotCount, openSlot + 2)));
    setOpenSlot(null);
  }

  function clearSlot(slotIndex: number) {
    const next = selectedIds.slice();
    next.splice(slotIndex, 1);
    onChange(next);
    onSlotCountChange(clampApprovalSlotCount(Math.max(2, safeSlotCount - 1, next.length + 1)));
  }

  function addSlot() {
    onSlotCountChange(clampApprovalSlotCount(safeSlotCount + 1));
  }

  function removeLastSlot() {
    const nextCount = clampApprovalSlotCount(safeSlotCount - 1);
    onChange(selectedIds.slice(0, nextCount - 1));
    onSlotCountChange(nextCount);
  }

  const slots = Array.from({ length: approverSlotCount }, (_, index) => {
    const employee = knownEmployees.find((item) => item.empId === selectedIds[index]);
    return { index, employee };
  });

  return (
    <div className="approval-line-editor">
      <div className="approval-line-editor-head">
        <h3>결재표</h3>
        <div className="actions">
          <button type="button" className="ghost" onClick={removeLastSlot} disabled={safeSlotCount <= 2}><Trash2 size={15} /> 결재 삭제</button>
          <button type="button" onClick={addSlot} disabled={safeSlotCount >= 6}><Plus size={15} /> 결재 추가</button>
        </div>
      </div>
      <div className="approval-stamp-wrap approval-stamp-editor">
        <div className="approval-stamp-label">결재</div>
        <div className="approval-stamp-table">
          <div className="approval-stamp-column requester">
            <div className="stamp-position">작성자</div>
            <div className="stamp-signature">{user.empName}</div>
            <div className="stamp-date"></div>
          </div>
          {slots.map(({ index, employee }) => (
            <div className="approval-stamp-column editable" key={index}>
              <div className="stamp-position">{employee?.positionName ?? `결재 ${index + 1}`}</div>
              <button type="button" className="stamp-signature stamp-signature-button" onClick={() => openPicker(index)}>
                {employee?.empName ?? "선택"}
              </button>
              <div className="stamp-date">
                {employee ? "클릭하여 변경" : "클릭하여 지정"}
                {employee && <button type="button" className="stamp-clear" onClick={() => clearSlot(index)}>삭제</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {openSlot !== null && (
        <div className="modal-backdrop" role="presentation">
          <div className="org-picker-modal" role="dialog" aria-modal="true" aria-label="결재자 선택">
            <div className="modal-head">
              <h3>{openSlot + 1}번 결재자 선택</h3>
              <button type="button" className="icon-button" onClick={() => setOpenSlot(null)} title="닫기"><X size={18} /></button>
            </div>
            <div className="org-picker-layout">
              <div className="org-picker-tree">
                {tree.map((node) => <DeptTree key={node.deptId} node={node} active={activeDeptId} onSelect={selectDept} />)}
              </div>
              <div className="org-picker-results">
                <div className="searchbar">
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 아이디, 사번 검색" />
                  <button type="button" onClick={() => search()}><Search size={16} /> 검색</button>
                </div>
                <div className="employee-result-list">
                  {candidates.map((employee) => (
                    <button key={employee.empId} type="button" className={selectedIds.includes(employee.empId) ? "active" : ""} onClick={() => assign(employee)}>
                      <strong>{employee.empName}</strong>
                      <span>{employee.deptName ?? "-"} · {employee.positionName ?? employee.jobTitle ?? employee.roleCode}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="org-picker-selected">
                <h3>현재 결재표</h3>
                {slots.map(({ index, employee }) => (
                  <div className="selected-approver" key={index}>
                    <strong>{index + 1}. {employee?.empName ?? "미지정"}</strong>
                    <span>{employee?.deptName ?? "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalStampTable({ approval }: { approval: Approval }) {
  const columns = padStampColumns([
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

function ApprovalOpinionList({ lines }: { lines: Approval["lines"] }) {
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

function signatureDisplayName(line: ApprovalLine) {
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

function NotificationPage({ go }: { go: (route: Route) => void }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  async function load() {
    const page = await api<PageResponse<NotificationItem>>(`/notifications?size=50${unreadOnly ? "&readYn=N" : ""}`);
    setItems(page.content);
  }

  useEffect(() => {
    void load();
  }, [unreadOnly]);

  async function markRead(id: number) {
    await api(`/notifications/${id}/read`, { method: "PUT" });
    await load();
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h3>알림</h3>
        <label className="check">
          <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} /> 미읽음만
        </label>
      </div>
      {items.length ? items.map((item) => (
        <div key={item.notificationId} className={item.read ? "notice-row read" : "notice-row"}>
          <div>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            <span>{item.readStatus === "READ" ? "읽음" : "미읽음"} · {formatDate(item.createdAt)}</span>
            {item.notificationStatus === "FAILED" && <span className="error">알림 발송 실패: {item.lastErrorMessage ?? "원인 미상"}</span>}
          </div>
          <div className="actions">
            {item.targetType === "APPROVAL" && item.targetId && <button className="ghost" onClick={() => go("approvals")}><ClipboardCheck size={16} /> 문서 바로가기</button>}
            {!item.read && (
              <button className="ghost" onClick={() => markRead(item.notificationId)}>
                <Check size={16} /> 읽음
              </button>
            )}
          </div>
        </div>
      )) : <Empty />}
    </div>
  );
}

function OrganizationPage() {
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [deptId, setDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [emps, setEmps] = useState<Employee[]>([]);

  useEffect(() => {
    void api<DeptNode[]>("/depts/tree").then(setTree);
  }, []);

  async function search(targetDept = deptId) {
    const params = new URLSearchParams({ page: "0", size: "20", status: "ACTIVE" });
    if (keyword) params.set("keyword", keyword);
    if (targetDept) params.set("deptId", String(targetDept));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    setEmps(page.content);
  }

  useEffect(() => {
    void search();
  }, [deptId]);

  return (
    <div className="org-layout">
      <div className="panel tree-panel">
        <h3>조직도</h3>
        {tree.map((node) => <DeptTree key={node.deptId} node={node} active={deptId} onSelect={setDeptId} />)}
      </div>
      <div className="panel">
        <div className="searchbar">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 아이디, 사번 검색" />
          <button onClick={() => search()}><Search size={16} /> 검색</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>부서</th>
              <th>직책</th>
              <th>역할</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {emps.map((emp) => (
              <tr key={emp.empId}>
                <td>{emp.empName}</td>
                <td>{emp.deptName ?? "-"}</td>
                <td>{emp.positionName ?? emp.jobTitle ?? "-"}</td>
                <td>{emp.roleCode}</td>
                <td>{emp.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!emps.length && <Empty text="검색된 직원이 없습니다." />}
      </div>
    </div>
  );
}

function DeptTree({ node, active, onSelect }: { node: DeptNode; active: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="tree-node">
      <button className={active === node.deptId ? "active" : ""} onClick={() => onSelect(node.deptId)}>{node.deptName}</button>
      {node.children.map((child) => <DeptTree key={child.deptId} node={child} active={active} onSelect={onSelect} />)}
    </div>
  );
}

function AuditLogPage() {
  const [items, setItems] = useState<AuditLog[]>([]);

  useEffect(() => {
    void api<PageResponse<AuditLog>>("/admin/audit-logs?size=100").then((page) => setItems(page.content));
  }, []);

  return (
    <div className="panel">
      <h3>감사 로그</h3>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>사용자</th>
            <th>작업</th>
            <th>대상</th>
            <th>IP</th>
            <th>일시</th>
          </tr>
        </thead>
        <tbody>
          {items.map((log) => (
            <tr key={log.auditId}>
              <td>{log.auditId}</td>
              <td>{log.empId ?? "-"}</td>
              <td>{log.actionType}</td>
              <td>{log.targetTable} #{log.targetId ?? "-"}</td>
              <td>{log.ipAddress ?? "-"}</td>
              <td>{formatDate(log.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="panel access-denied">
      <Shield />
      <h3>접근 권한이 없습니다.</h3>
    </div>
  );
}

function Toolbar({ title, onNew, onRefresh, beforeRefresh }: { title: string; onNew: () => void; onRefresh?: () => void; beforeRefresh?: ReactNode }) {
  return (
    <div className="toolbar">
      <h3>{title}</h3>
      <div className="toolbar-actions">
        {beforeRefresh}
        {onRefresh && <button className="ghost" onClick={onRefresh}><RefreshCw size={16} /> 새로고침</button>}
        <button onClick={onNew}><Plus size={16} /> 작성</button>
      </div>
    </div>
  );
}

function ListSummary({ count, text }: { count: number; text: string }) {
  return <div className="list-summary"><strong>{count}</strong><span>{text}</span></div>;
}

function ContentTable({ rows, pinnedLabel = "고정", metricLabel = "조회수" }: {
  rows: {
    id: number;
    pinned?: boolean;
    title: string;
    writer: string;
    date: string;
    hasAttachment: boolean;
    views: ReactNode;
    onOpen: () => void;
  }[];
  pinnedLabel?: string;
  metricLabel?: string;
}) {
  return (
    <div className="table-wrap">
      <table className="content-table">
        <thead>
          <tr>
            <th className="col-no">번호</th>
            <th>제목</th>
            <th className="col-writer">작성자</th>
            <th className="col-date">작성일</th>
            <th className="col-attach">첨부</th>
            <th className="col-views">{metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.pinned ? "pinned-row" : ""}>
              <td className="col-no">{row.id}</td>
              <td>
                <button className="title-link" onClick={row.onOpen}>
                  {row.pinned && <span className="pin-label"><Flag size={14} /> {pinnedLabel}</span>}
                  <span>{row.title}</span>
                </button>
              </td>
              <td className="col-writer">{row.writer}</td>
              <td className="col-date">{row.date}</td>
              <td className="col-attach">{row.hasAttachment ? <Paperclip size={16} /> : <span className="dash">-</span>}</td>
              <td className="col-views"><Eye size={15} /> {row.views}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailPage({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  return (
    <div className="detail-page">
      <button className="back-button" onClick={onBack}>
        <ArrowLeft size={16} /> 목록으로
      </button>
      {children}
    </div>
  );
}

function TwoPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="two-pane">
      <section className="panel list-pane">{left}</section>
      <section className="panel detail-pane">{right}</section>
    </div>
  );
}

function EmptyDetail({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-detail">
      <Inbox size={42} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function ReadDetail({ title, content, meta, badge, canEdit, onEdit, onDelete, editLabel = "수정", deleteLabel = "삭제" }: {
  title: string;
  content: string;
  meta: string;
  badge?: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
  headerAside?: ReactNode;
}) {
  return (
    <article className="read-detail">
      <div className="detail-actions">
        <div>
          {badge && <span className="badge">{badge}</span>}
          <h2>{title}</h2>
          <p>{meta}</p>
        </div>
        {canEdit && (
          <div className="actions">
            <button onClick={onEdit}><Edit3 size={16} /> {editLabel}</button>
            <button className="danger" onClick={onDelete}><Trash2 size={16} /> {deleteLabel}</button>
          </div>
        )}
      </div>
      <div className="detail-content">{content ? <RichContent content={content} /> : "내용이 없습니다."}</div>
    </article>
  );
}

function NoticeEditor({ title, form, setForm, pendingFiles, setPendingFiles, onSave, onCancel, onDelete }: {
  title: string;
  form: NoticeForm;
  setForm: (value: NoticeForm) => void;
  pendingFiles: DraftAttachment[];
  setPendingFiles: (value: DraftAttachment[]) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="editor">
      <EditorHeader title={title} onSave={onSave} onCancel={onCancel} onDelete={onDelete} />
      <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="제목" />
      <EditorTools content={form.content} onChange={(content) => setForm({ ...form, content })} />
      <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="내용" />
      <DraftAttachmentPicker files={pendingFiles} onChange={setPendingFiles} />
      <div className="editor-options">
        <label className="check">
          <input type="checkbox" checked={form.pinned} onChange={(event) => setForm({ ...form, pinned: event.target.checked })} />
          <span>상단 고정</span>
        </label>
      </div>
    </div>
  );
}

function BoardEditor({ title, form, setForm, pendingFiles, setPendingFiles, onSave, onCancel, onDelete }: {
  title: string;
  form: BoardForm;
  setForm: (value: BoardForm) => void;
  pendingFiles: DraftAttachment[];
  setPendingFiles: (value: DraftAttachment[]) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="editor">
      <EditorHeader title={title} onSave={onSave} onCancel={onCancel} onDelete={onDelete} />
      <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="제목" />
      <EditorTools content={form.content} onChange={(content) => setForm({ ...form, content })} />
      <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="내용" />
      <DraftAttachmentPicker files={pendingFiles} onChange={setPendingFiles} />
      <div className="editor-options">
        <label className="check">
          <input type="checkbox" checked={form.draft} onChange={(event) => setForm({ ...form, draft: event.target.checked })} />
          <span>임시글</span>
        </label>
      </div>
    </div>
  );
}

function EditorTools({ content, onChange }: { content: string; onChange: (content: string) => void }) {
  function insertImage() {
    const url = window.prompt("본문에 넣을 이미지 URL을 입력하세요.");
    if (!url?.trim()) return;
    const alt = window.prompt("이미지 설명을 입력하세요.")?.trim() || "image";
    const next = `${content}${content.endsWith("\n") || !content ? "" : "\n\n"}![${alt}](${url.trim()})`;
    onChange(next);
  }

  return (
    <div className="editor-tools">
      <button type="button" className="ghost" onClick={insertImage}>
        <Paperclip size={15} /> 본문 이미지
      </button>
      <span>이미지 URL은 본문 안에 바로 표시됩니다.</span>
    </div>
  );
}

function DraftAttachmentPicker({ files, onChange }: { files: DraftAttachment[]; onChange: (files: DraftAttachment[]) => void }) {
  function add(fileList: FileList | null) {
    if (!fileList?.length) return;
    const next = Array.from(fileList).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file
    }));
    onChange([...files, ...next]);
  }

  function remove(id: string) {
    onChange(files.filter((file) => file.id !== id));
  }

  return (
    <div className="draft-attachments">
      <div className="panel-head">
        <h3>첨부파일</h3>
        <label className="file-button">
          <input type="file" multiple onChange={(event) => add(event.target.files)} />
          <Plus size={16} /> 파일 선택
        </label>
      </div>
      {files.length ? files.map((attachment) => (
        <div className="file-row" key={attachment.id}>
          <strong className="file-link">{attachment.file.name}</strong>
          <span>{Math.ceil(attachment.file.size / 1024)} KB · 저장 시 업로드</span>
          <button type="button" className="danger ghost" onClick={() => remove(attachment.id)}>
            <Trash2 size={15} /> 제거
          </button>
        </div>
      )) : <Empty text="저장 전에 첨부할 파일을 선택할 수 있습니다." />}
    </div>
  );
}

function RichContent({ content }: { content: string }) {
  const imagePattern = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imagePattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<p key={`text-${lastIndex}`}>{content.slice(lastIndex, match.index)}</p>);
    }
    parts.push(<img key={`image-${match.index}`} src={match[2]} alt={match[1] || "본문 이미지"} />);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push(<p key={`text-${lastIndex}`}>{content.slice(lastIndex)}</p>);
  }

  return <>{parts}</>;
}

function EditorHeader({ title, onSave, onCancel, onDelete }: { title: string; onSave: () => void; onCancel: () => void; onDelete?: () => void }) {
  return (
    <div className="panel-head">
      <h3>{title}</h3>
      <div className="actions">
        <button onClick={onSave}><Save size={16} /> 저장</button>
        <button className="ghost" onClick={onCancel}><X size={16} /> 취소</button>
        {onDelete && <button className="danger" onClick={onDelete}><Trash2 size={16} /> 삭제</button>}
      </div>
    </div>
  );
}

function CommentBox({ comments, onSubmit }: { comments: { commentId: number; writerName: string; content: string; createdAt: string }[]; onSubmit: (content: string) => void }) {
  const [content, setContent] = useState("");

  return (
    <div className="comments">
      <h3>댓글</h3>
      {comments.length ? comments.map((comment) => (
        <div className="comment" key={comment.commentId}>
          <strong>{comment.writerName}</strong>
          <span>{formatDate(comment.createdAt)}</span>
          <p>{comment.content}</p>
        </div>
      )) : <Empty text="등록된 댓글이 없습니다." />}
      <div className="comment-form">
        <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="댓글 작성" />
        <button onClick={() => { onSubmit(content); setContent(""); }}>등록</button>
      </div>
    </div>
  );
}

function AttachmentBox({ targetType, targetId, readOnly = false, canDownload = true }: { targetType: string; targetId: number; readOnly?: boolean; canDownload?: boolean }) {
  const [files, setFiles] = useState<AttachFile[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api<AttachFile[]>(`/files?targetType=${targetType}&targetId=${targetId}`);
    setFiles(data);
  }

  useEffect(() => {
    void load();
  }, [targetType, targetId]);

  async function upload(selectedFiles: FileList | null) {
    if (!selectedFiles?.length) return;
    const formData = new FormData();
    formData.set("targetType", targetType);
    formData.set("targetId", String(targetId));
    Array.from(selectedFiles).forEach((file) => formData.append("files", file));
    setBusy(true);
    try {
      await api<AttachFile[]>("/files/batch", { method: "POST", body: formData });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(fileId: number) {
    await api(`/files/${fileId}`, { method: "DELETE" });
    await load();
  }

  async function download(file: AttachFile) {
    if (!canDownload) return;
    const response = await authenticatedFetch(`/files/${file.fileId}/download`);
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.originalFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="attachments">
      <div className="panel-head">
        <h3>첨부파일</h3>
        {!readOnly && <label className="file-button">
          <input type="file" multiple onChange={(event) => upload(event.target.files)} disabled={busy} />
          <Plus size={16} /> 파일 추가
        </label>}
      </div>
      {files.length ? files.map((file) => (
        <div className="file-row" key={file.fileId}>
          <button className="file-link" onClick={() => download(file)} disabled={!canDownload}>{file.originalFileName}</button>
          <span>{Math.ceil(file.fileSize / 1024)} KB · SHA-256</span>
          {!readOnly && <button className="danger ghost" onClick={() => remove(file.fileId)}><Trash2 size={15} /> 삭제</button>}
        </div>
      )) : <Empty text="첨부파일이 없습니다." />}
    </div>
  );
}

export default App;
