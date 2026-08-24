import {
} from "lucide-react";
import type {
  Approval,
  ApprovalDefaultLineStepApi,
  ApprovalLine,
  ApprovalTemplateApi,
  Employee,
  EquipmentProposal,
  LeaveUsage,
  User
} from "../types";
export type Route = "dashboard" | "adminDashboard" | "approvalAdmin" | "search" | "notices" | "boards" | "approvals" | "pdm" | "equipment" | "plannedFeature" | "notifications" | "organization" | "employees" | "audit";
export type ContentMode = "list" | "detail" | "create" | "edit" | "templates" | "delegation" | "operationSettings" | "holidays" | "annualLeaves" | "leavePolicies" | "compTime" | "deleted";
export type ApprovalDelegationForm = { delegateEmpId: number | null; startDate: string; endDate: string; reason: string; active: boolean };
export type ApprovalOperationSettingsForm = { decisionDueHours: number; reminderFixedDelayMs: number; deletedDocumentRetentionDays: number; permanentDeleteEnabled: boolean; leaveDefaultReceiverEmpId: number | null };
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
  sourceApprovalId?: number;
  sourceDocumentNo?: string | null;
};

export const PURCHASE_RECEIVER_LOGIN_ID = "lim.purchase";
export const TRAINING_RECEIVER_LOGIN_ID = "hong.gildong";
export const PURCHASE_BU_CODES = ["BU1", "BU2", "BU3", "BU4", "BU5", "BU7", "BU9", "BU20", "EC", "BU60"] as const;

export const DEFAULT_APPROVAL_TEMPLATES: ApprovalTemplateOption[] = [
  { code: "GENERAL", name: "일반문서", description: "일반 업무 기안", version: 1 },
  { code: "WORK_REQUEST", name: "근무신청서", description: "잔업·특근 근무 신청", version: 1 },
  { code: "EMERGENCY_CALL_REQUEST", name: "비상호출 신청서", description: "비상호출 근무 신청", version: 1 },
  { code: "WORK_REQUEST_CHANGE", name: "근무 변경·취소계", description: "승인된 근무의 변경 또는 취소 신청", version: 1 },
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
  { id: "work", label: "3. 근무", codes: ["WORK_REQUEST", "EMERGENCY_CALL_REQUEST", "WORK_REQUEST_CHANGE"] },
  { id: "purchase", label: "4. 구매", codes: ["PURCHASE"] },
  { id: "education", label: "5. 교육 및 제안", codes: ["TRAINING_REQUEST", "TRAINING_REPORT"] }
];
export const ENABLE_TEMPLATE_FALLBACK = import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEMPLATE_FALLBACK === "true";
export const LEAVE_TYPE_OPTIONS = [
  "연차",
  "오전반차",
  "오후반차",
  "조퇴",
  "하계휴가",
  "공가",
  "공가(오전)",
  "공가(오후)",
  "경조",
  "대체휴무",
  "병가",
  "공상",
  "산재요양",
  "무급휴가",
  "배우자 출산휴가",
  "출산전후휴가",
  "여성휴가",
  "유산·사산휴가",
  "난임치료휴가",
  "육아휴직"
];

const REMOVED_LEAVE_TYPES = new Set(["자녀돌봄휴가", "특별유급휴가", "가족돌봄휴가"]);
const LEAVE_TYPE_PRIORITY = new Map(["연차", "오전반차", "오후반차"].map((type, index) => [type, index]));

export function selectableLeaveTypeOptions(options: string[]) {
  const unique = Array.from(new Set(options)).filter((type) => !REMOVED_LEAVE_TYPES.has(type));
  const originalOrder = new Map(unique.map((type, index) => [type, index]));
  return unique.sort((left, right) =>
    (LEAVE_TYPE_PRIORITY.get(left) ?? 3 + (originalOrder.get(left) ?? 0))
    - (LEAVE_TYPE_PRIORITY.get(right) ?? 3 + (originalOrder.get(right) ?? 0))
  );
}
export const DEFAULT_TOTAL_ANNUAL_DAYS = "22";

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
    permanentDeleteEnabled: false,
    leaveDefaultReceiverEmpId: null
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

export function currentUserDeptName(user: User, employees: Employee[] = [], fallback = "") {
  return user.deptName?.trim()
    || employees.find((employee) => employee.empId === user.empId)?.deptName?.trim()
    || fallback.trim();
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

export function isWorkRequestTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "WORK_REQUEST";
}

export function isEmergencyCallRequestTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "EMERGENCY_CALL_REQUEST";
}

export function isWorkRequestChangeTemplateCode(templateCode: string | null | undefined) {
  return templateCode === "WORK_REQUEST_CHANGE";
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

export function leaveReceiverId(employees: Employee[], configuredEmpId?: number | null) {
  if (!configuredEmpId) return null;
  return employees.some((employee) => employee.empId === configuredEmpId) ? configuredEmpId : null;
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
