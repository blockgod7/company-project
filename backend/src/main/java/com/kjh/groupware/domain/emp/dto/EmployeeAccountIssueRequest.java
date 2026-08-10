package com.kjh.groupware.domain.emp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EmployeeAccountIssueRequest(@NotBlank @Size(max = 50) String loginId) {}
