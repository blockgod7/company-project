package com.kjh.groupware.domain.emp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record EmployeeWorkCategoryRequest(
    @NotBlank @Pattern(regexp = "MANAGEMENT|FIELD") String workCategory
) {}
