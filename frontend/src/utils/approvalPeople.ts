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
import type { ApprovalForm, ApprovalTemplateAdminForm, ApprovalTemplateField, ApprovalTemplateOption } from "./approvalDomainCore";
import { purchaseReceiverId } from "./approvalDomainCore";
export function employeeDisplay(employee?: Employee) {
  if (!employee) return "-";
  return `${employee.deptName ?? "-"} ${employee.empName}`;
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

// Display/default hint only; the server snapshots the authoritative PROD_TECH code on submission.
export function isProductionEngineeringRequester(user: User, employees: Employee[]) {
  const deptName = (user.deptName ?? employees.find((employee) => employee.empId === user.empId)?.deptName ?? "").replace(/\s/g, "");
  return deptName === "생산기술" || deptName === "생산기술팀";
}

export function equipmentProposalReceiverId(user: User, employees: Employee[]) {
  if (!isProductionEngineeringRequester(user, employees)) return productionEngineeringManagerId(employees);
  const purchaseEmployees = employees.filter((employee) => ["구매", "구매팀"].includes(employee.deptName ?? ""));
  return purchaseReceiverId(purchaseEmployees) ?? purchaseEmployees[0]?.empId ?? null;
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
