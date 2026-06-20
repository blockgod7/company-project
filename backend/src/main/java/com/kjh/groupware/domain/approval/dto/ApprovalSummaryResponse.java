package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalLine;
import java.time.LocalDateTime;
import java.util.List;

public record ApprovalSummaryResponse(
    Long approvalId,
    String documentNo,
    String title,
    String templateCode,
    Integer templateVersion,
    String pdfStatus,
    String status,
    String currentStage,
    String priority,
    LocalDateTime requestedAt,
    LocalDateTime completedAt,
    Long requesterEmpId,
    String requesterName,
    String currentApproverName,
    LocalDateTime deletedAt,
    Long deletedByEmpId,
    String deletedByName
) {

    public static ApprovalSummaryResponse from(ApprovalDocument document, List<ApprovalLine> lines) {
        String currentApproverName = lines.stream()
            .filter(line -> ApprovalLine.STATUS_PENDING.equals(line.getStatus()))
            .findFirst()
            .map(line -> line.getApprover().getEmpName())
            .orElse(null);
        return new ApprovalSummaryResponse(
            document.getApprovalId(),
            document.getDocumentNo(),
            document.getTitle(),
            document.getTemplateCode(),
            document.getTemplateVersion(),
            document.getPdfStatus(),
            document.getStatus(),
            document.getCurrentStage(),
            document.getPriority(),
            document.getRequestedAt(),
            document.getCompletedAt(),
            document.getRequester().getEmpId(),
            document.getRequester().getEmpName(),
            currentApproverName,
            document.getDeletedAt(),
            document.getDeletedBy() == null ? null : document.getDeletedBy().getEmpId(),
            document.getDeletedBy() == null ? null : document.getDeletedBy().getEmpName()
        );
    }
}
