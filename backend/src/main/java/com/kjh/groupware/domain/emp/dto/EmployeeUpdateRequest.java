package com.kjh.groupware.domain.emp.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record EmployeeUpdateRequest(
    @NotBlank @Size(max = 100) String empName,
    @NotBlank @Pattern(regexp = "MALE|FEMALE") String genderCode,
    @Email @Size(max = 150) String email,
    @Size(max = 50) String phone,
    @Size(max = 20) String extensionNumber,
    Long deptId,
    @Size(max = 50) String positionName,
    @Size(max = 50) String jobTitle,
    Long managerEmpId,
    @NotNull LocalDate hireDate,
    @NotBlank @Pattern(regexp = "REGULAR|CONTRACT") String employmentType,
    LocalDate contractStartDate,
    LocalDate contractEndDate
) {}
