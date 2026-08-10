package com.kjh.groupware.domain.emp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.LocalDate;

public record EmployeeRehireRequest(
    @NotNull LocalDate rehireDate,
    @NotBlank @Pattern(regexp = "REGULAR|CONTRACT") String employmentType,
    LocalDate contractStartDate,
    LocalDate contractEndDate
) {}
