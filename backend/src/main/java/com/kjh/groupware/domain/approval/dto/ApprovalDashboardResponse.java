package com.kjh.groupware.domain.approval.dto;

public record ApprovalDashboardResponse(
    long myPendingCount,
    long delegatedPendingCount,
    long overdueCount,
    long requestedInProgressCount,
    long recentCompletedCount
) {
}
