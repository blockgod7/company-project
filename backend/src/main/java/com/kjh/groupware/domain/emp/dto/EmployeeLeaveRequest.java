package com.kjh.groupware.domain.emp.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record EmployeeLeaveRequest(
    @NotBlank @Size(max = 40) String leaveType,
    @NotNull LocalDate startDate,
    @NotNull LocalDate endDate,
    @Size(max = 500) String note
) {}
