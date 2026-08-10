package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record ApprovalHolidayRequest(
    @NotNull LocalDate holidayDate,
    @NotBlank @Size(max = 100) String holidayName,
    @NotBlank String holidayType,
    Boolean active,
    String sourceType,
    String repeatType,
    @Size(max = 500) String basisSource,
    @Size(max = 500) String overrideReason
) {
    public ApprovalHolidayRequest(
        LocalDate holidayDate,
        String holidayName,
        String holidayType,
        Boolean active
    ) {
        this(holidayDate, holidayName, holidayType, active, null, null, null, null);
    }
}
