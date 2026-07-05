package com.kjh.groupware.domain.pdm.dto;

import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.pdm.PdmDownloadRequest;
import java.time.LocalDateTime;

public record PdmDownloadRequestResponse(
    Long requestId,
    Long drawingId,
    String drawingNo,
    String drawingTitle,
    Long revisionId,
    String revisionLabel,
    Long approvalId,
    String approvalStatus,
    LocalDateTime approvedUntil,
    String reason
) {
    public static PdmDownloadRequestResponse from(PdmDownloadRequest request) {
        ApprovalDocument approval = request.getApproval();
        return new PdmDownloadRequestResponse(
            request.getRequestId(),
            request.getDrawing().getDrawingId(),
            request.getDrawing().getDrawingNo(),
            request.getDrawing().getTitle(),
            request.getRevision().getRevisionId(),
            request.getRevision().getRevisionLabel(),
            approval.getApprovalId(),
            approval.getStatus(),
            request.approvedUntil(),
            request.getReason()
        );
    }
}
