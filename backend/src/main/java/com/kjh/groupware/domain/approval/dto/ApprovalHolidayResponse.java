package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalHoliday;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record ApprovalHolidayResponse(
    Long holidayId,
    LocalDate holidayDate,
    String holidayName,
    String holidayType,
    String sourceType,
    String repeatType,
    Integer applyYear,
    Integer repeatMonth,
    Integer repeatDay,
    String policyVersion,
    String basisSource,
    boolean official,
    boolean active,
    Long createdByEmpId,
    String createdByName,
    LocalDateTime createdAt,
    Long updatedByEmpId,
    String updatedByName,
    LocalDateTime updatedAt
) {
    public static ApprovalHolidayResponse from(ApprovalHoliday holiday) {
        return new ApprovalHolidayResponse(
            holiday.getHolidayId(),
            holiday.getHolidayDate(),
            holiday.getHolidayName(),
            holiday.getHolidayType(),
            holiday.getSourceType(),
            holiday.getRepeatType(),
            holiday.getApplyYear(),
            holiday.getRepeatMonth(),
            holiday.getRepeatDay(),
            holiday.getPolicyVersion(),
            holiday.getBasisSource(),
            holiday.isOfficial(),
            holiday.isActive(),
            holiday.getCreatedBy() == null ? null : holiday.getCreatedBy().getEmpId(),
            holiday.getCreatedBy() == null ? null : holiday.getCreatedBy().getEmpName(),
            holiday.getCreatedAt(),
            holiday.getUpdatedBy() == null ? null : holiday.getUpdatedBy().getEmpId(),
            holiday.getUpdatedBy() == null ? null : holiday.getUpdatedBy().getEmpName(),
            holiday.getUpdatedAt()
        );
    }

    public ApprovalHolidayResponse withHolidayDate(LocalDate date) {
        return new ApprovalHolidayResponse(
            holidayId, date, holidayName, holidayType, sourceType, repeatType, date.getYear(),
            repeatMonth, repeatDay, policyVersion, basisSource, official, active, createdByEmpId, createdByName,
            createdAt, updatedByEmpId, updatedByName, updatedAt
        );
    }
}
