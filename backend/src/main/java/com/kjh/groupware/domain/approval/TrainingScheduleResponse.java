package com.kjh.groupware.domain.approval;

import java.time.LocalDate;

public record TrainingScheduleResponse(
    Long sourceApprovalId, String documentNo, Long currentApprovalId,
    String trainingName, String institution, LocalDate startDate, LocalDate endDate,
    String status, boolean changeable, boolean reportable,
    Long pendingChangeApprovalId, Long reportApprovalId, String blockedReason
) {}
