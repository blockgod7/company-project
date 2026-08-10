package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record LeavePolicyOverrideRequest(
    @NotNull Long empId,
    @NotNull LocalDate referenceDate,
    @NotNull @DecimalMin("0.5") @Digits(integer = 3, fraction = 1) BigDecimal maxDays,
    @NotNull @Min(1) Integer maxSegments,
    @NotBlank @Size(max = 500) String reason
) {}
