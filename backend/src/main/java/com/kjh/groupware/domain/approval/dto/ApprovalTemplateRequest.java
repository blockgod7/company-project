package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ApprovalTemplateRequest(
    @NotBlank @Size(max = 50) String templateCode,
    @NotBlank @Size(max = 100) String templateName,
    @Size(max = 500) String description,
    @NotBlank String fieldsJson,
    String printLayoutJson,
    Integer sortOrder,
    Boolean active
) {
}
