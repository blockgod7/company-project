package com.kjh.groupware.domain.approval.dto;

import java.util.List;

public record ApprovalHolidayImpactResponse(
    Long holidayId,
    String holidayDate,
    String holidayName,
    int affectedCount,
    List<Item> items
) {
    public record Item(Long approvalId, String documentNo, Long requesterEmpId, String requesterName, String leaveDate, String leaveType, String restoredDays) {}
}
