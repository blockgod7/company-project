import type { Employee, LeaveUsage, User } from "../types";
import {
  currentUserDeptName, defaultApprovalForm, isEquipmentProposalTemplateCode,
  isLeaveCancelTemplateCode, isLeaveTemplateCode, isPurchaseTemplateCode,
  isTrainingReportTemplateCode, isTrainingRequestTemplateCode, isTrainingTemplateCode,
  leaveReceiverId, leaveUsageFieldValues, equipmentProposalReceiverId,
  purchaseDefaultFieldValues, purchaseReceiverId, trainingReceiverId,
  trainingReportDefaultFieldValues, trainingRequestDefaultFieldValues,
  type ApprovalForm, type ApprovalTemplateOption
} from "./approvalDomain";

// Creation and template preview must start from the same defaults.
export function createApprovalForm(template: ApprovalTemplateOption, user: User, employees: Employee[], leaveUsage: LeaveUsage | null, leaveDefaultReceiverEmpId?: number | null): ApprovalForm {
  const leave = isLeaveTemplateCode(template.code) || isLeaveCancelTemplateCode(template.code);
  const purchase = isPurchaseTemplateCode(template.code);
  const training = isTrainingTemplateCode(template.code);
  const equipment = isEquipmentProposalTemplateCode(template.code);
  const receiverId = leave ? leaveReceiverId(employees, leaveDefaultReceiverEmpId)
    : purchase ? purchaseReceiverId(employees)
    : training ? trainingReceiverId(employees)
    : equipment ? equipmentProposalReceiverId(user, employees) : null;
  return {
    ...defaultApprovalForm([template]),
    title: purchase || training || equipment ? "" : template.name,
    fieldValues: equipment ? { requestDeptName: currentUserDeptName(user, employees) }
      : purchase ? purchaseDefaultFieldValues(user, employees)
      : isTrainingRequestTemplateCode(template.code) ? trainingRequestDefaultFieldValues(user, employees)
      : isTrainingReportTemplateCode(template.code) ? trainingReportDefaultFieldValues(user, employees)
      : leave ? leaveUsageFieldValues(leaveUsage) : {},
    receiverEmpIds: receiverId ? [receiverId] : []
  };
}
