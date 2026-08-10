package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record LeavePolicyRequest(
    @NotBlank @Size(max = 50) String leaveType,
    @NotBlank @Size(max = 100) String displayName,
    @NotNull Boolean active,
    @NotBlank String payType,
    @NotNull @DecimalMin("0.0") @DecimalMax("30.0") @Digits(integer = 2, fraction = 1) BigDecimal annualDeductionDays,
    @NotBlank String unitType,
    @DecimalMin("0.5") @DecimalMax("365.0") @Digits(integer = 3, fraction = 1) BigDecimal maxDays,
    @Min(0) @Max(3650) Integer periodBeforeDays,
    @Min(0) @Max(3650) Integer periodAfterDays,
    @NotBlank String genderRestriction,
    @NotNull Boolean evidenceRequired,
    @Min(1) @Max(100) Integer maxSegments,
    @NotNull Boolean adminOverrideAllowed,
    @NotNull LocalDate effectiveFrom,
    LocalDate effectiveTo,
    @NotBlank @Size(max = 500) String changeReason
) {
}
