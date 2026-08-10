package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LeaveAdminReasonRequest(Boolean paid, String status, @NotBlank @Size(max = 500) String reason) {}
