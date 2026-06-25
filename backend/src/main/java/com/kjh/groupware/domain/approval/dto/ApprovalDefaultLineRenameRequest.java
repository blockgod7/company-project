package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ApprovalDefaultLineRenameRequest(
    @NotBlank @Size(max = 100) String lineName
) {
}
