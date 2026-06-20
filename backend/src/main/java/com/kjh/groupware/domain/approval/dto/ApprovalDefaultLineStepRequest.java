package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.NotNull;

public record ApprovalDefaultLineStepRequest(
    Integer stepOrder,
    @NotNull Long approverEmpId,
    String lineType,
    Boolean required
) {
}
