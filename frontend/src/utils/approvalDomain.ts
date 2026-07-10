import {
  Bell,
  BookOpen,
  Building2,
  ClipboardCheck,
  FolderKanban,
  Home,
  MessageSquare
} from "lucide-react";
import type { LucideIcon } from "lucide-react";import type {
  Approval,
  ApprovalDefaultLineStepApi,
  ApprovalLine,
  ApprovalTemplateApi,
  Employee,
  EquipmentProposal,
  LeaveUsage,
  User
} from "../types";
export type Route = "dashboard" | "search" | "notices" | "boards" | "approvals" | "pdm" | "notifications" | "organization" | "audit";
export type ContentMode = "list" | "detail" | "create" | "edit" | "templates" | "delegation" | "operationSettings" | "deleted";
export type ApprovalDelegationForm = { delegateEmpId: number | null; startDate: string; endDate: string; reason: string; active: boolean };
export type ApprovalOperationSettingsForm = { decisionDueHours: number; reminderFixedDelayMs: number; deletedDocumentRetentionDays: number; permanentDeleteEnabled: boolean };
export type ApprovalTemplateOption = {
  code: string;
  name: string;
  description: string;
  version?: number | null;
  fieldsJson?: string;
  printLayoutJson?: string | null;
  activeYn?: "Y" | "N";
  sortOrder?: number;
};
export type ApprovalTemplateCategory = {
  id: string;
  label: string;
  codes: string[];
};
export type ApprovalTemplateAdminForm = {
  templateCode: string;
  templateName: string;
  description: string;
  fieldsJson: string;
  printLayoutJson: string;
  sortOrder: number;
  active: boolean;
};
export type ApprovalTemplateField = {
  name: string;
  label: string;
  type?: string;
  options?: string[];
  required?: boolean | string;
};
export type ApprovalBox = "agreement" | "pending" | "received" | "shared" | "requested" | "processed" | "all";
export type ApprovalDashboardFilter = "actionRequired" | "approvedInProgress" | "drafts" | "completedInvolved" | "myPending" | "delegatedPending" | "overdue" | "requestedInProgress" | "recentCompleted";
export type ApprovalLaunch = { box: ApprovalBox; dashboardFilter?: ApprovalDashboardFilter; label: string };
export type ApprovalCategory = "active" | "completed";
export type ApprovalSearchForm = {
  keyword: string;
  status: string;
  templateCode: string;
  dateFrom: string;
  dateTo: string;
  role: string;
};
export type ApprovalForm = {
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
export type ApprovalBoxApi = { code: string; label: string };
export type MoldFixturePart = {
  partName: string;
  cavity: string;
  material: string;
  quantity: string;
  moldNo: string;
};
export type PurchaseRequestItem = {
  itemName: string;
  spec: string;
  quantity: string;
  usage: string;
};
export type LeaveSelection = {
  date: string;
  type: string;
  days: number;
};

export const PURCHASE_RECEIVER_LOGIN_ID = "lim.purchase";
export const TRAINING_RECEIVER_LOGIN_ID = "hong.gildong";
export const PURCHASE_BU_CODES = ["BU1", "BU2", "BU3", "BU4", "BU5", "BU7", "BU9", "BU20", "EC", "BU60"] as const;

export const DEFAULT_APPROVAL_TEMPLATES: ApprovalTemplateOption[] = [
  { code: "GENERAL", name: "일반문서", description: "일반 업무 기안", version: 1 },
  { code: "PURCHASE", name: "구매요청서", description: "물품 또는 서비스 구매 요청", version: 1 },
  { code: "EQUIPMENT_PROPOSAL", name: "설비 품의서", description: "사용부서, 생산기술팀, 구매팀이 단계별로 작성하는 설비 품의서", version: 1 },
  { code: "MOLD_FIXTURE_PROPOSAL", name: "금형 치공구 품의서", description: "설비 품의서와 동일한 단계로 작성하는 금형 치공구 품의서", version: 1 },
  { code: "TRAINING_REQUEST", name: "교육신청서", description: "교육 수강, 변경, 불참 신청", version: 1 },
  { code: "TRAINING_REPORT", name: "교육훈련보고서", description: "교육 결과 및 업무 반영 보고", version: 1 },
  { code: "MONTHLY_MAINTENANCE", name: "월간보전계획서", description: "월간 보전 계획", version: 1 },
  { code: "ANNUAL_MAINTENANCE", name: "연간보전계획서", description: "연간 보전 계획", version: 1 },
  { code: "EQUIPMENT_REPAIR", name: "설비수리보고서", description: "설비 수리 결과 보고", version: 1 }
];

export const DEFAULT_APPROVAL_SEARCH: ApprovalSearchForm = {
  keyword: "",
  status: "",
  templateCode: "",
  dateFrom: "",
  dateTo: "",
  role: ""
};
export const APPROVAL_TEMPLATE_CATEGORIES: ApprovalTemplateCategory[] = [
  { id: "draft", label: "1. 기안 공문", codes: ["DRAFT", "EQUIPMENT_PROPOSAL", "MOLD_FIXTURE_PROPOSAL"] },
  { id: "leave", label: "2. 휴가, 출장", codes: ["LEAVE", "LEAVE_CANCEL"] },
  { id: "purchase", label: "3. 구매", codes: ["PURCHASE"] },
  { id: "education", label: "4. 교육 및 제안", codes: ["TRAINING_REQUEST", "TRAINING_REPORT"] }
];
export const ENABLE_TEMPLATE_FALLBACK = import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEMPLATE_FALLBACK === "true";
export const LEAVE_TYPE_OPTIONS = [
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
export const DEFAULT_TOTAL_ANNUAL_DAYS = "22";
export const KOREAN_PUBLIC_HOLIDAYS: Record<string, string> = {
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

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function defaultDelegationForm(): ApprovalDelegationForm {
  return {
    delegateEmpId: null,
    startDate: todayDate(),
    endDate: "",
    reason: "",
    active: true
  };
}

export function defaultOperationSettingsForm(): ApprovalOperationSettingsForm {
  return {
    decisionDueHours: 72,
    reminderFixedDelayMs: 300000,
    deletedDocumentRetentionDays: 1825,
    permanentDeleteEnabled: false
  };
}

export function defaultApprovalForm(templates = DEFAULT_APPROVAL_TEMPLATES): ApprovalForm {
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

export function approvalTemplateByCode(templates: ApprovalTemplateOption[], templateCode: string | null | undefined) {
  if (!templateCode) return undefined;
  return templates.find((item) => item.code === templateCode)
    ?? DEFAULT_APPROVAL_TEMPLATES.find((item) => item.code === templateCode);
}

export function categorizedTemplateGroups(templates: ApprovalTemplateOption[]) {
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

export function selectableApprovalTemplates(templates: ApprovalTemplateOption[]) {
  return categorizedTemplateGroups(templates).flatMap((category) => category.templates);
}

export function firstSelectableApprovalTemplate(templates: ApprovalTemplateOption[]) {
  return selectableApprovalTemplates(templates)[0] ?? templates[0] ?? DEFAULT_APPROVAL_TEMPLATES[0];
}

export function idsFromJson(value: unknown) {
  return Array.isArray(value) ? value.filter((id): id is number => typeof id === "number") : [];
}

export function approvalDraftData(approval: Approval) {
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

export function approvalContent(approval: Approval) {
  const draftData = approvalDraftData(approval);
  return approval.content === "{content=}" ? draftData.content : approval.content;
}

export function isDraftTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "DRAFT";
}

export function isLeaveTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "LEAVE";
}

export function isLeaveCancelTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "LEAVE_CANCEL";
}

export function isPurchaseTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "PURCHASE";
}

export function isTrainingRequestTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "TRAINING_REQUEST";
}

export function isTrainingReportTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "TRAINING_REPORT";
}

export function isTrainingTemplateCode(templateCode: string | null | undefined) {
  return isTrainingRequestTemplateCode(templateCode) || isTrainingReportTemplateCode(templateCode);
}

export function isReceiverRoutedTemplateCode(templateCode: string | null | undefined) {
  return isPurchaseTemplateCode(templateCode) || isTrainingTemplateCode(templateCode);
}

export function isEquipmentProposalTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "EQUIPMENT_PROPOSAL" || templateCode === "MOLD_FIXTURE_PROPOSAL";
}

export function equipmentProposalTitle(templateCode: string | null | undefined) {
  return templateCode === "MOLD_FIXTURE_PROPOSAL" ? "금형 치공구 품의서" : "설비 품의서";
}

export function equipmentProposalItemLabel(templateCode: string | null | undefined) {
  return templateCode === "MOLD_FIXTURE_PROPOSAL" ? "금형/치공구명" : "설비명";
}

export function equipmentProposalCapacityLabel(templateCode: string | null | undefined) {
  return templateCode === "MOLD_FIXTURE_PROPOSAL" ? "규격/용도" : "설비용량(능력)";
}

export function equipmentProposalItemFallback(templateCode: string | null | undefined) {
  return templateCode === "MOLD_FIXTURE_PROPOSAL" ? "금형 치공구" : "설비";
}

export function equipmentProposalGeneratedTitle(values: Record<string, string>, templateCode: string | null | undefined) {
  const itemName = (isMoldFixtureTemplateCode(templateCode) ? values.moldNo : values.equipmentName)?.trim()
    || equipmentProposalItemFallback(templateCode);
  const requestType = values.requestType?.trim();
  return `${itemName}${requestType ? ` ${requestType}` : ""} 품의서`;
}

export function isMoldFixtureTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "MOLD_FIXTURE_PROPOSAL";
}

export function blankMoldFixturePart(): MoldFixturePart {
  return { partName: "", cavity: "", material: "", quantity: "", moldNo: "" };
}

export function normalizeMoldFixtureParts(parts: MoldFixturePart[]) {
  const normalized = parts.length ? parts : [blankMoldFixturePart()];
  return normalized.map((part) => ({
    partName: part.partName ?? "",
    cavity: part.cavity ?? "",
    material: part.material ?? "",
    quantity: part.quantity ?? "",
    moldNo: part.moldNo ?? ""
  }));
}

export function parseMoldFixtureParts(values: Record<string, unknown> | EquipmentProposal): MoldFixturePart[] {
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

export function moldFixturePartsJson(parts: MoldFixturePart[]) {
  return JSON.stringify(normalizeMoldFixtureParts(parts));
}

export function blankPurchaseItem(): PurchaseRequestItem {
  return { itemName: "", spec: "", quantity: "", usage: "" };
}

export function normalizePurchaseItems(items: PurchaseRequestItem[]) {
  const normalized = items.length ? items : [blankPurchaseItem()];
  return normalized.map((item) => ({
    itemName: item.itemName ?? "",
    spec: item.spec ?? "",
    quantity: item.quantity ?? "",
    usage: item.usage ?? ""
  }));
}

export function parsePurchaseItems(values: Record<string, unknown>): PurchaseRequestItem[] {
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

export function purchaseItemsJson(items: PurchaseRequestItem[]) {
  return JSON.stringify(normalizePurchaseItems(items));
}

export function purchaseBuTotal(values: Record<string, string>) {
  return PURCHASE_BU_CODES.reduce((sum, code) => sum + Number(values[`bu_${code}`] || 0), 0);
}

export function purchaseDefaultFieldValues(user: User, employees: Employee[], current: Record<string, string> = {}): Record<string, string> {
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

export function purchaseReceiverId(employees: Employee[]) {
  return employees.find((employee) => employee.loginId === PURCHASE_RECEIVER_LOGIN_ID)?.empId ?? null;
}

export function trainingReceiverId(employees: Employee[]) {
  return employees.find((employee) => employee.loginId === TRAINING_RECEIVER_LOGIN_ID)?.empId ?? null;
}

export function purchaseReceiptDate(lines: ApprovalLine[]) {
  const receiver = lines
    .filter((line) => line.lineType === "RECEIVER")
    .sort((a, b) => a.lineOrder - b.lineOrder)
    .find((line) => line.readAt || line.actedAt);
  return receiver?.readAt ?? receiver?.actedAt ?? "";
}

export function purchaseRequestContent(values: Record<string, string>) {
  const items = parsePurchaseItems(values).filter((item) => Object.values(item).some((value) => value.trim()));
  const first = items[0];
  return [
    `요구일: ${values.requiredDate ?? ""}`,
    first ? `대표품목: ${first.itemName || "-"} / ${first.spec || "-"} / ${first.quantity || "-"}` : "",
    `BU 분할 합계: ${purchaseBuTotal(values)}%`
  ].filter(Boolean).join("\n");
}

export function validatePurchaseRequest(values: Record<string, string>, title: string) {
  if (!title.trim()) return "구매요구서 제목을 입력해 주세요.";
  if (!values.requiredDate?.trim()) return "요구일을 입력해 주세요.";
  const items = parsePurchaseItems(values).filter((item) => Object.values(item).some((value) => value.trim()));
  if (!items.length) return "구매 품목을 1건 이상 입력해 주세요.";
  const invalidItem = items.find((item) => !item.itemName.trim() || !item.spec.trim() || !item.quantity.trim() || !item.usage.trim());
  if (invalidItem) return "품명, 규격, 수량, 용도를 모두 입력해 주세요.";
  const total = purchaseBuTotal(values);
  return Math.abs(total - 100) > 0.0001 ? "BU 비용분할 합계는 100%가 되어야 합니다." : "";
}

export function trainingRequestDefaultFieldValues(user: User, employees: Employee[], current: Record<string, string> = {}): Record<string, string> {
  const employee = employees.find((item) => item.empId === user.empId);
  return {
    requestType: current.requestType || "수강",
    deptName: currentUserDeptName(user, employees, current.deptName ?? ""),
    positionName: current.positionName || employee?.positionName || employee?.jobTitle || "",
    requesterName: current.requesterName || user.empName,
    trainingName: current.trainingName ?? "",
    institution: current.institution ?? "",
    trainingStartDate: current.trainingStartDate ?? "",
    trainingEndDate: current.trainingEndDate ?? "",
    reason: current.reason ?? "",
    requestDate: current.requestDate || todayDate()
  };
}

export function trainingRequestContent(values: Record<string, string>) {
  return [
    `교육명: ${values.trainingName || "-"}`,
    `교육기관: ${values.institution || "-"}`,
    `교육기간: ${values.trainingStartDate || "-"} ~ ${values.trainingEndDate || "-"}`,
    `신청 구분: ${values.requestType || "수강"}`,
    `사유: ${values.reason || "-"}`
  ].join("\n");
}

export function trainingRequestClosingText(values: Record<string, string>) {
  const trainingName = values.trainingName?.trim() || "상기";
  const requestType = values.requestType?.trim() || "수강";
  const subject = trainingName.endsWith("교육") ? trainingName : `${trainingName} 교육`;
  return `본인은 상기와 같이 ${subject}의 ${requestType}을 신청합니다.`;
}

export function validateTrainingRequest(values: Record<string, string>, title: string, receiverEmpIds: number[]) {
  if (!title.trim()) return "교육신청서 제목을 입력해 주세요.";
  if (!["수강", "변경", "불참"].includes(values.requestType ?? "")) return "수강, 변경, 불참 중 하나를 선택해 주세요.";
  if (!values.trainingName?.trim()) return "교육명을 입력해 주세요.";
  if (!values.institution?.trim()) return "교육기관을 입력해 주세요.";
  if (values.approvalDelegationEnabled === "Y" && (!values.trainingStartDate?.trim() || !values.trainingEndDate?.trim())) return "대리결재를 적용하려면 교육 시작일과 종료일을 입력해 주세요.";
  if (!values.reason?.trim()) return "사유를 입력해 주세요.";
  if (receiverEmpIds.length !== 1) return "주관부서 수신자는 1명만 지정해 주세요.";
  return "";
}

export function trainingReportDefaultFieldValues(user: User, employees: Employee[], current: Record<string, string> = {}): Record<string, string> {
  const employee = employees.find((item) => item.empId === user.empId);
  return {
    reportDate: current.reportDate || todayDate(),
    empNo: current.empNo || employee?.empNo || "",
    requesterName: current.requesterName || user.empName,
    signatureName: current.signatureName || user.empName,
    trainingName: current.trainingName ?? "",
    institution: current.institution ?? "",
    trainingPeriod: current.trainingPeriod ?? "",
    mainContent: current.mainContent ?? "",
    jobApplication: current.jobApplication ?? "",
    impression: current.impression ?? "",
    nextTraining: current.nextTraining ?? "",
    effectiveness: current.effectiveness ?? "",
    hrRecordCheck: current.hrRecordCheck ?? ""
  };
}

export function trainingReportContent(values: Record<string, string>) {
  return [
    `교육명: ${values.trainingName || "-"}`,
    `교육기관: ${values.institution || "-"}`,
    `교육기간: ${values.trainingPeriod || "-"}`,
    `주요교육내용: ${values.mainContent || "-"}`,
    `업무수행방안: ${values.jobApplication || "-"}`,
    `교육소감: ${values.impression || "-"}`
  ].join("\n");
}

export function validateTrainingReport(values: Record<string, string>, title: string, receiverEmpIds: number[]) {
  if (!title.trim()) return "교육훈련보고서 제목을 입력해 주세요.";
  if (!values.trainingName?.trim()) return "교육명을 입력해 주세요.";
  if (!values.institution?.trim()) return "교육기관을 입력해 주세요.";
  if (!values.trainingPeriod?.trim()) return "교육기간을 입력해 주세요.";
  if (receiverEmpIds.length !== 1) return "주관부서 수신자는 1명만 지정해 주세요.";
  return "";
}

export function employeeDisplay(employee?: Employee) {
  if (!employee) return "-";
  return `${employee.deptName ?? "-"} ${employee.empName}`;
}

export function currentUserDeptName(user: User, employees: Employee[] = [], fallback = "") {
  return user.deptName?.trim()
    || employees.find((employee) => employee.empId === user.empId)?.deptName?.trim()
    || fallback.trim();
}

export function employeesByIds(employees: Employee[], ids: number[]) {
  return ids.map((id) => employees.find((employee) => employee.empId === id)).filter((employee): employee is Employee => !!employee);
}

export function formatEmployeeList(employees: Employee[], ids: number[]) {
  const selected = employeesByIds(employees, ids);
  return selected.length ? selected.map(employeeDisplay).join(", ") : "-";
}

export function approvalLinePerson(line: ApprovalLine) {
  const dept = line.deptNameSnapshot ?? line.approverDeptName ?? "-";
  const name = line.empNameSnapshot ?? line.approverName;
  return `${dept} ${name}`;
}

export function formatApprovalLines(lines: ApprovalLine[], lineType: ApprovalLine["lineType"]) {
  const selected = lines.filter((line) => line.lineType === lineType).sort((a, b) => a.lineOrder - b.lineOrder);
  return selected.length ? selected.map(approvalLinePerson).join(", ") : "-";
}

export function firstReceiverLineOrder(lines: ApprovalLine[]) {
  return lines
    .filter((line) => line.lineType === "RECEIVER")
    .map((line) => line.lineOrder)
    .sort((a, b) => a - b)[0] ?? Number.POSITIVE_INFINITY;
}

export function lastReceiverLineOrder(lines: ApprovalLine[]) {
  const orders = lines
    .filter((line) => line.lineType === "RECEIVER")
    .map((line) => line.lineOrder)
    .sort((a, b) => b - a);
  return orders[0] ?? Number.NEGATIVE_INFINITY;
}

export function approvalOpinionLines(lines: ApprovalLine[]) {
  return lines
    .filter((line) => (line.lineType === "AGREEMENT" || line.lineType === "APPROVAL") && line.comment?.trim())
    .sort((a, b) => a.lineOrder - b.lineOrder);
}

export function defaultLineIds(steps: ApprovalDefaultLineStepApi[], lineType: ApprovalDefaultLineStepApi["lineType"]) {
  return steps
    .filter((step) => step.lineType === lineType)
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((step) => step.approverEmpId);
}

export function productionEngineeringManagerId(employees: Employee[]) {
  const manager = employees.find((employee) =>
    employee.deptName === "생산기술" && (employee.roleCode === "MANAGER" || employee.jobTitle?.includes("팀장") || employee.positionName?.includes("팀장"))
  );
  return manager?.empId ?? employees.find((employee) => employee.loginId === "cho.pe")?.empId ?? null;
}

export function isDeptManagerUser(user: User, employees: Employee[], deptName: string) {
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

export function defaultLinePayload(form: ApprovalForm, lineName = "내 기본 결재선", includeReceivers = true) {
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

export function templateOptionFromApi(item: ApprovalTemplateApi): ApprovalTemplateOption {
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

export function templateAdminFormFromOption(template?: ApprovalTemplateOption): ApprovalTemplateAdminForm {
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

export function parseTemplateFields(fieldsJson?: string | null): ApprovalTemplateField[] {
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

export function isRequiredTemplateField(field: ApprovalTemplateField) {
  return field.required === true || String(field.required).toLowerCase() === "true" || String(field.required).toUpperCase() === "Y";
}

export function leaveDayValue(type: string) {
  if (type === "연차") return 1;
  if (type === "오전반차" || type === "오후반차") return 0.5;
  return 0;
}

export function formatDayValue(value?: string | number | null) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return String(Number(numeric.toFixed(1)));
}

export function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLeaveSelections(values: Record<string, string> | null | undefined): LeaveSelection[] {
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

export function leaveSummary(selections: LeaveSelection[]) {
  return selections.map((selection) => `${formatShortDate(selection.date)} ${selection.type}`).join(", ");
}

export function leaveDateRangeText(values: Record<string, string>) {
  const startDate = values.startDate ?? "";
  const endDate = values.endDate ?? "";
  const days = formatDayValue(values.days);
  if (!startDate && !endDate) return `- [ ${days} 일 ]`;
  return `${startDate || endDate} ~ ${endDate || startDate} [ ${days} 일 ]`;
}

export function leaveRequestContent(values: Record<string, string>) {
  return [
    `신청기간: ${leaveDateRangeText(values)}`,
    `신청구분: ${values.leaveType ?? "-"}`,
    `연차 사용일수: ${formatDayValue(values.days)}일`,
    `신청 후 잔여 연차일수: ${formatDayValue(values.remainingAnnualDays)}일`
  ].filter(Boolean).join("\n");
}

export function leaveCancelContent(values: Record<string, string>) {
  return [
    `취소기간: ${leaveDateRangeText(values)}`,
    `취소구분: ${values.leaveType ?? "-"}`,
    `취소 연차일수: ${formatDayValue(values.days)}일`
  ].filter(Boolean).join("\n");
}

export function leaveUsageFieldValues(usage: LeaveUsage | null): Record<string, string> {
  return {
    usedAnnualDays: formatDayValue(usage?.usedAnnualDays ?? "0"),
    totalAnnualDays: formatDayValue(usage?.totalAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS),
    remainingAnnualDays: formatDayValue(usage?.remainingAnnualDays ?? DEFAULT_TOTAL_ANNUAL_DAYS)
  };
}

export function withLeaveCancelTemplate(templates: ApprovalTemplateOption[]) {
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

export function remainingAnnualDaysText(totalDays: string | number | null | undefined, usedBefore: string | number | null | undefined, requestedDays: string | number | null | undefined) {
  return formatDayValue(Number(totalDays ?? 0) - Number(usedBefore ?? 0) - Number(requestedDays ?? 0));
}

export const routeLabels: Record<Route, string> = {
  dashboard: "대시보드",
  search: "전역 검색",
  notices: "공지사항",
  boards: "게시판",
  approvals: "전자결재",
  pdm: "도면관리",
  notifications: "알림",
  organization: "조직도",
  audit: "감사 로그"
};

export const menu: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: "dashboard", label: "홈", icon: Home },
  { route: "notices", label: "공지사항", icon: BookOpen },
  { route: "boards", label: "게시판", icon: MessageSquare },
  { route: "approvals", label: "전자결재", icon: ClipboardCheck },
  { route: "pdm", label: "도면관리", icon: FolderKanban },
  { route: "organization", label: "조직도", icon: Building2 },
  { route: "notifications", label: "알림", icon: Bell }
];


