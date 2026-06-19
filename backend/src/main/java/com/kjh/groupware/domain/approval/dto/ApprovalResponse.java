package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalLine;
import java.time.LocalDateTime;
import java.util.List;

public record ApprovalResponse(
    Long approvalId,
    String documentNo,
    String title,
    String content,
    String templateCode,
    Integer templateVersion,
    String templateSnapshotJson,
    String formDataJson,
    String pdfStatus,
    Long pdfFileId,
    LocalDateTime pdfGeneratedAt,
    String pdfErrorMessage,
    String pdfHash,
    String status,
    LocalDateTime requestedAt,
    LocalDateTime completedAt,
    Long requesterEmpId,
    String requesterName,
    String requesterDeptName,
    String requesterPositionName,
    List<ApprovalLineResponse> lines
) {

    public static ApprovalResponse from(ApprovalDocument document, List<ApprovalLine> lines) {
        return new ApprovalResponse(
            document.getApprovalId(),
            document.getDocumentNo(),
            document.getTitle(),
            document.getContent(),
            document.getTemplateCode(),
            document.getTemplateVersion(),
            document.getTemplateSnapshotJson(),
            document.getFormDataJson(),
            document.getPdfStatus(),
            document.getPdfFile() == null ? null : document.getPdfFile().getFileId(),
            document.getPdfGeneratedAt(),
            document.getPdfErrorMessage(),
            document.getPdfHash(),
            document.getStatus(),
            document.getRequestedAt(),
            document.getCompletedAt(),
            document.getRequester().getEmpId(),
            document.getRequester().getEmpName(),
            document.getRequester().getDept() == null ? null : document.getRequester().getDept().getDeptName(),
            document.getRequester().getPositionName(),
            lines.stream().map(ApprovalLineResponse::from).toList()
        );
    }
}
