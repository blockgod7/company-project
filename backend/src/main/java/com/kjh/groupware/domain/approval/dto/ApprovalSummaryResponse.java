package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalLine;
import java.time.LocalDateTime;
import java.util.List;

public record ApprovalSummaryResponse(
    Long approvalId,
    String title,
    String status,
    LocalDateTime requestedAt,
    LocalDateTime completedAt,
    Long requesterEmpId,
    String requesterName,
    String currentApproverName
) {

    public static ApprovalSummaryResponse from(ApprovalDocument document, List<ApprovalLine> lines) {
        String currentApproverName = lines.stream()
            .filter(line -> ApprovalLine.STATUS_PENDING.equals(line.getStatus()))
            .findFirst()
            .map(line -> line.getApprover().getEmpName())
            .orElse(null);
        return new ApprovalSummaryResponse(
            document.getApprovalId(),
            document.getTitle(),
            document.getStatus(),
            document.getRequestedAt(),
            document.getCompletedAt(),
            document.getRequester().getEmpId(),
            document.getRequester().getEmpName(),
            currentApproverName
        );
    }
}
