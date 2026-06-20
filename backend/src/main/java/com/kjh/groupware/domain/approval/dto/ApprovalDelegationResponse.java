package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalDelegation;
import java.time.LocalDate;

public record ApprovalDelegationResponse(
    Long delegationId,
    Long ownerEmpId,
    String ownerName,
    Long delegateEmpId,
    String delegateName,
    String delegateDeptName,
    String delegatePositionName,
    LocalDate startDate,
    LocalDate endDate,
    String reason,
    String activeYn,
    boolean activeNow
) {

    public static ApprovalDelegationResponse from(ApprovalDelegation delegation) {
        return new ApprovalDelegationResponse(
            delegation.getDelegationId(),
            delegation.getOwnerEmp().getEmpId(),
            delegation.getOwnerEmp().getEmpName(),
            delegation.getDelegateEmp().getEmpId(),
            delegation.getDelegateEmp().getEmpName(),
            delegation.getDelegateEmp().getDept() == null ? null : delegation.getDelegateEmp().getDept().getDeptName(),
            delegation.getDelegateEmp().getPositionName(),
            delegation.getStartDate(),
            delegation.getEndDate(),
            delegation.getReason(),
            delegation.getActiveYn(),
            delegation.isActiveOn(LocalDate.now())
        );
    }
}
