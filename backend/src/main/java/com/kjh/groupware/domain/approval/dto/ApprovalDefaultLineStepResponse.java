package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalDefaultLineStep;
import com.kjh.groupware.domain.emp.Emp;

public record ApprovalDefaultLineStepResponse(
    Long stepId,
    Integer stepOrder,
    Long approverEmpId,
    String approverName,
    String approverDeptName,
    String approverPositionName,
    String lineType,
    Boolean required
) {

    public static ApprovalDefaultLineStepResponse from(ApprovalDefaultLineStep step) {
        Emp approver = step.getApprover();
        return new ApprovalDefaultLineStepResponse(
            step.getDefaultLineStepId(),
            step.getStepOrder(),
            approver.getEmpId(),
            approver.getEmpName(),
            approver.getDept() == null ? null : approver.getDept().getDeptName(),
            approver.getPositionName(),
            step.getLineType(),
            !"N".equals(step.getRequiredYn())
        );
    }
}
