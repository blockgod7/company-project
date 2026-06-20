package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalPermissionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.exception.BusinessException;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ApprovalPermissionService {

    public ApprovalPermissionResponse permissions(Emp emp, ApprovalDocument document, List<ApprovalLine> lines) {
        boolean requester = isRequester(emp, document);
        boolean decisionAssignee = lines.stream().anyMatch(line -> line.isDecisionLine() && line.isAssignedTo(emp));
        boolean receiver = lines.stream().anyMatch(line -> line.isReceiver() && line.isAssignedTo(emp));
        boolean shared = lines.stream().anyMatch(line -> (line.isReference() || line.isReader()) && line.isAssignedTo(emp));
        boolean auditAdmin = isAuditAdmin(emp);
        boolean approved = ApprovalDocument.STATUS_APPROVED.equals(document.getStatus());
        boolean viewByPostApprovalRole = approved && (receiver || shared);
        boolean canView = requester || decisionAssignee || viewByPostApprovalRole || auditAdmin;
        boolean pendingDecision = lines.stream().anyMatch(line -> line.isDecisionLine() && line.isPendingFor(emp));
        boolean canApprove = pendingDecision;
        boolean canReject = pendingDecision;
        boolean canWithdraw = requester
            && document.isPending()
            && lines.stream().filter(ApprovalLine::isDecisionLine).noneMatch(ApprovalLine::isActed);
        boolean canReceive = approved && lines.stream()
            .anyMatch(line -> line.isReceiver() && line.isAssignedTo(emp) && ApprovalLine.STATUS_RECEIVED.equals(line.getStatus()));
        boolean canCompleteReceipt = approved && lines.stream()
            .anyMatch(line -> line.isReceiver()
                && line.isAssignedTo(emp)
                && (ApprovalLine.STATUS_RECEIVED.equals(line.getStatus()) || ApprovalLine.STATUS_READ.equals(line.getStatus())));

        return new ApprovalPermissionResponse(
            canView,
            requester && document.isEditableDraft(),
            requester && document.isEditableDraft(),
            canApprove,
            canReject,
            canWithdraw,
            requester && ApprovalDocument.STATUS_REJECTED.equals(document.getStatus()),
            requester && document.isDraft(),
            canReceive,
            canCompleteReceipt,
            canView,
            canView,
            canView
        );
    }

    public void assertCanView(Emp emp, ApprovalDocument document, List<ApprovalLine> lines) {
        if (!permissions(emp, document, lines).canView()) {
            throw BusinessException.forbidden("APPROVAL_VIEW_FORBIDDEN", "문서 조회 권한이 없습니다.");
        }
    }

    public void assertCanDownloadAttachment(Emp emp, ApprovalDocument document, List<ApprovalLine> lines) {
        if (!permissions(emp, document, lines).canDownloadAttachment()) {
            throw BusinessException.forbidden("APPROVAL_FILE_DOWNLOAD_FORBIDDEN", "첨부파일 다운로드 권한이 없습니다.");
        }
    }

    public void assertCanPrintPdf(Emp emp, ApprovalDocument document, List<ApprovalLine> lines) {
        if (!permissions(emp, document, lines).canPrintPdf()) {
            throw BusinessException.forbidden("APPROVAL_PDF_FORBIDDEN", "PDF 출력 권한이 없습니다.");
        }
    }

    private boolean isRequester(Emp emp, ApprovalDocument document) {
        return emp != null && document.getRequester().getEmpId().equals(emp.getEmpId());
    }

    private boolean isAuditAdmin(Emp emp) {
        return emp != null && ("ADMIN".equals(emp.getRoleCode()) || "AUDIT_ADMIN".equals(emp.getRoleCode()));
    }
}
