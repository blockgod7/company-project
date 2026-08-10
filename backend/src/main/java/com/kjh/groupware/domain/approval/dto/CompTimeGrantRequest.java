package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CompTimeGrantRequest(
    @NotNull Long empId,
    @NotNull LocalDate workDate,
    @NotNull @DecimalMin("0.5") @DecimalMax("1.0") @Digits(integer = 1, fraction = 1) BigDecimal grantedDays,
    @NotBlank @Size(max = 500) String reason,
    LocalDate expiresOn
) {}
