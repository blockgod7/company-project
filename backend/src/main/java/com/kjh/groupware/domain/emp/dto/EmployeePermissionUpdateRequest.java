package com.kjh.groupware.domain.emp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EmployeePermissionUpdateRequest(
    @NotBlank String permissionCode,
    boolean active,
    @Size(max = 500) String reason
) {}
