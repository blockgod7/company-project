package com.kjh.groupware.domain.approval.dto;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
public record AnnualLeaveAdjustmentRequest(
    @NotNull Long empId,
    @NotNull @Min(2000) @Max(2100) Integer leaveYear,
    @NotNull @DecimalMin("0.0") @DecimalMax("30.0") BigDecimal finalDays,
    @NotBlank @Size(max = 500) String reason
) {}
