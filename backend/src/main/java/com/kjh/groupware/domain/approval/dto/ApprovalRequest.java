package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ApprovalRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank String content,
    @NotEmpty List<Long> approverEmpIds
) {
}
