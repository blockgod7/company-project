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
    String currentStage,
    String priority,
    LocalDateTime requestedAt,
    LocalDateTime firstSubmittedAt,
    LocalDateTime lastSubmittedAt,
    Integer submitCount,
    LocalDateTime completedAt,
    LocalDateTime withdrawnAt,
    String withdrawReason,
    Long requesterEmpId,
    String requesterName,
    String requesterDeptName,
    String requesterPositionName,
    Long draftDeptId,
    String draftDeptCode,
    String draftDeptName,
    List<ApprovalLineResponse> lines,
    ApprovalPermissionResponse permissions
) {

    public static ApprovalResponse from(ApprovalDocument document, List<ApprovalLine> lines) {
        return from(document, lines, null);
    }

    public static ApprovalResponse from(ApprovalDocument document, List<ApprovalLine> lines, ApprovalPermissionResponse permissions) {
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
            document.getCurrentStage(),
            document.getPriority(),
            document.getRequestedAt(),
            document.getFirstSubmittedAt(),
            document.getLastSubmittedAt(),
            document.getSubmitCount(),
            document.getCompletedAt(),
            document.getWithdrawnAt(),
            document.getWithdrawReason(),
            document.getRequester().getEmpId(),
            document.getRequester().getEmpName(),
            document.getRequester().getDept() == null ? null : document.getRequester().getDept().getDeptName(),
            document.getRequester().getPositionName(),
            document.getDraftDeptId(),
            document.getDraftDeptCode(),
            document.getDraftDeptName(),
            lines.stream().map(ApprovalLineResponse::from).toList(),
            permissions
        );
    }
}
