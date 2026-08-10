package com.kjh.groupware.domain.approval.dto;

import java.math.BigDecimal;
import java.util.List;

public record CompTimeSummaryResponse(
    Long empId,
    String empName,
    BigDecimal availableDays,
    BigDecimal reservedDays,
    List<CompTimeCreditResponse> credits
) {}
