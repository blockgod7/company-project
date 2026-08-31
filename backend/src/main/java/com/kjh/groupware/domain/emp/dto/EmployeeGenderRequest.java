package com.kjh.groupware.domain.emp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record EmployeeGenderRequest(
    @NotBlank @Pattern(regexp = "MALE|FEMALE") String genderCode
) {}
