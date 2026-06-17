package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalLine;
import java.time.LocalDateTime;
import java.util.List;

public record ApprovalResponse(
    Long approvalId,
    String title,
    String content,
    String status,
    LocalDateTime requestedAt,
    LocalDateTime completedAt,
    Long requesterEmpId,
    String requesterName,
    String requesterDeptName,
    List<ApprovalLineResponse> lines
) {

    public static ApprovalResponse from(ApprovalDocument document, List<ApprovalLine> lines) {
        return new ApprovalResponse(
            document.getApprovalId(),
            document.getTitle(),
            document.getContent(),
            document.getStatus(),
            document.getRequestedAt(),
            document.getCompletedAt(),
            document.getRequester().getEmpId(),
            document.getRequester().getEmpName(),
            document.getRequester().getDept() == null ? null : document.getRequester().getDept().getDeptName(),
            lines.stream().map(ApprovalLineResponse::from).toList()
        );
    }
}
