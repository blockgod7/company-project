package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalLeaveAdminCase;

public record LeaveAdminCaseResponse(Long approvalId, String sickPayType, String sickPayReason, String workersCompStatus, String workersCompReason) {
    public static LeaveAdminCaseResponse from(ApprovalLeaveAdminCase value) {
        return new LeaveAdminCaseResponse(value.getApproval().getApprovalId(), value.getSickPayType(), value.getSickPayReason(), value.getWorkersCompStatus(), value.getWorkersCompReason());
    }
}
