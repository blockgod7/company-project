package com.kjh.groupware.domain.emp.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record EmployeeRetireRequest(@NotNull LocalDate retireDate) {}
