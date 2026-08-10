package com.kjh.groupware.domain.emp.dto;

import java.util.List;

public record EmployeeLeaveImpactResponse(int affectedDateCount, List<Item> items) {
    public record Item(Long approvalId, String documentNo, String status, String date, String leaveType) {}
}
