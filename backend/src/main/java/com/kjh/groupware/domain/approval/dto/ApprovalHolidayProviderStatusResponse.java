package com.kjh.groupware.domain.approval.dto;

import java.util.List;

public record ApprovalHolidayProviderStatusResponse(
    List<Integer> builtInYears,
    boolean openApiConfigured,
    String providerName,
    String basisSource
) {}
