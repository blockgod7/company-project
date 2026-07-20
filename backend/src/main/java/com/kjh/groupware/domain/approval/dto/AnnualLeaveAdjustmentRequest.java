package com.kjh.groupware.domain.approval.dto;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
public record AnnualLeaveAdjustmentRequest(@NotNull Long empId, @NotNull @DecimalMin("-30.0") @DecimalMax("30.0") BigDecimal adjustmentDays, @Size(max = 500) String reason) {}
