package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalLine;
import java.time.LocalDateTime;

public record ApprovalLineResponse(
    Long lineId,
    Integer lineOrder,
    String status,
    String comment,
    LocalDateTime actedAt,
    LocalDateTime signedAt,
    Long signatureSnapshotFileId,
    String signatureSnapshotJson,
    Long approverEmpId,
    String approverName,
    String approverDeptName,
    String approverPositionName
) {

    public static ApprovalLineResponse from(ApprovalLine line) {
        return new ApprovalLineResponse(
            line.getLineId(),
            line.getLineOrder(),
            line.getStatus(),
            line.getComment(),
            line.getActedAt(),
            line.getSignedAt(),
            line.getSignatureSnapshotFile() == null ? null : line.getSignatureSnapshotFile().getFileId(),
            line.getSignatureSnapshotJson(),
            line.getApprover().getEmpId(),
            line.getApprover().getEmpName(),
            line.getApprover().getDept() == null ? null : line.getApprover().getDept().getDeptName(),
            line.getApprover().getPositionName()
        );
    }
}
