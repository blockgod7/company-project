package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalLeaveExclusion;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record LeaveExclusionResponse(
    Long exclusionId,
    Long approvalId,
    String documentNo,
    LocalDate date,
    String type,
    String restoredDays,
    Long holidayId,
    String holidayName,
    String holidayType,
    String reason,
    LocalDateTime excludedAt
) {
    public static LeaveExclusionResponse from(ApprovalLeaveExclusion exclusion) {
        return new LeaveExclusionResponse(
            exclusion.getExclusionId(),
            exclusion.getDocument().getApprovalId(),
            exclusion.getDocument().getDocumentNo(),
            exclusion.getLeaveDate(),
            exclusion.getLeaveType(),
            exclusion.getRestoredDays().stripTrailingZeros().toPlainString(),
            exclusion.getHoliday().getHolidayId(),
            exclusion.getHoliday().getHolidayName(),
            exclusion.getHoliday().getHolidayType(),
            exclusion.getReason(),
            exclusion.getCreatedAt()
        );
    }
}
