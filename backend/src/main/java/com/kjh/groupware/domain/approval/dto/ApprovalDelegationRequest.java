package com.kjh.groupware.domain.approval.dto;

import java.time.LocalDate;

public record ApprovalDelegationRequest(
    Long delegateEmpId,
    LocalDate startDate,
    LocalDate endDate,
    String reason,
    Boolean active
) {
}
