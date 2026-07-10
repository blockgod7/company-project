import { formatDate } from "./date";
import type { ApprovalLine, ApprovalSummary } from "../types";

type TemplateNameOption = {
  code: string;
  name: string;
};

export function documentPrefix(templateCode: string | null | undefined) {
  if (templateCode === "LEAVE") return "LEV";
  if (templateCode === "LEAVE_CANCEL") return "LVC";
  if (templateCode === "PURCHASE") return "PUR";
  if (templateCode === "TRAINING_REQUEST" || templateCode === "TRAINING_REPORT") return "EDU";
  if (templateCode === "EQUIPMENT_PROPOSAL") return "EQP";
  if (templateCode === "MOLD_FIXTURE_PROPOSAL") return "MFP";
  return "APP";
}

export function templateName(templates: TemplateNameOption[], code: string | null) {
  return templates.find((template) => template.code === code)?.name ?? code ?? "-";
}

export function priorityLabel(priority: ApprovalSummary["priority"]) {
  return priority === "URGENT" ? "긴급" : priority === "IMPORTANT" ? "중요" : "일반";
}

export function statusLabel(status: ApprovalSummary["status"]) {
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

export function retentionAuditActionLabel(actionType: string) {
  if (actionType === "DELETE_APPROVAL") return "보존삭제";
  if (actionType === "RESTORE_APPROVAL") return "복구";
  return actionType;
}

export function stageLabel(stage: ApprovalSummary["currentStage"]) {
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

export function lineStatusLabel(status: ApprovalLine["status"]) {
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

export function lineTypeLabel(lineType: ApprovalLine["lineType"]) {
  const labels: Record<ApprovalLine["lineType"], string> = {
    AGREEMENT: "합의",
    APPROVAL: "결재",
    RECEIVER: "수신",
    REFERENCE: "참조",
    READER: "열람"
  };
  return labels[lineType] ?? lineType;
}

export function lineDueText(line: ApprovalLine) {
  if (!line.dueAt || line.status !== "PENDING") return null;
  const overdue = new Date(line.dueAt).getTime() < Date.now();
  return `${overdue ? "기한 초과" : "처리 기한"} ${formatDate(line.dueAt)}`;
}

export function lineAssignedName(line: ApprovalLine) {
  return line.empNameSnapshot ?? line.approverName;
}

export function lineActedName(line: ApprovalLine) {
  return line.actedEmpName ?? signatureDisplayName(line);
}

export function isDelegatedAction(line: ApprovalLine) {
  if (!line.actedEmpId || !line.assignedEmpId || line.actedEmpId === line.assignedEmpId) return false;
  return line.status === "APPROVED" || line.status === "REJECTED" || line.status === "RECEIPT_COMPLETED";
}

export function delegatedActionText(line: ApprovalLine) {
  if (!isDelegatedAction(line)) return null;
  return `${lineAssignedName(line)} 대리로 ${lineActedName(line)} 처리`;
}

export function approvalProgress(lines: ApprovalLine[]) {
  const agreements = lines.filter((line) => line.lineType === "AGREEMENT");
  const approvals = lines.filter((line) => line.lineType === "APPROVAL");
  const agreed = agreements.filter((line) => line.status === "APPROVED").length;
  const approved = approvals.filter((line) => line.status === "APPROVED").length;
  if (agreements.length && agreed < agreements.length) return `합의 ${agreed}/${agreements.length} 완료`;
  if (approvals.length) return `결재 ${approved}/${approvals.length} 진행`;
  return "-";
}

export function receiverProgress(lines: ApprovalLine[]) {
  const receivers = lines.filter((line) => line.lineType === "RECEIVER");
  if (!receivers.length) return "-";
  const completed = receivers.filter((line) => line.status === "RECEIPT_COMPLETED").length;
  const read = receivers.filter((line) => line.status === "READ").length;
  return completed ? `접수완료 ${completed}/${receivers.length}` : read ? `수신확인 ${read}/${receivers.length}` : "수신 미접수";
}

function signatureDisplayName(line: ApprovalLine) {
  return line.actedEmpName ?? line.empNameSnapshot ?? line.approverName;
}
