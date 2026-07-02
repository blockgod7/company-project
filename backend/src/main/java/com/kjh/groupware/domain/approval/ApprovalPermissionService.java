package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalPermissionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.exception.BusinessException;
import java.util.List;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ApprovalPermissionService {

    private final ApprovalDelegationService delegationService;

    public ApprovalPermissionResponse permissions(Emp emp, ApprovalDocument document, List<ApprovalLine> lines) {
        boolean requester = isRequester(emp, document);
        boolean decisionAssignee = lines.stream().anyMatch(line -> line.isDecisionLine() && line.isAssignedTo(emp));
        boolean delegatedPendingDecisionAssignee = lines.stream().anyMatch(line -> line.isDecisionLine()
            && ApprovalLine.STATUS_PENDING.equals(line.getStatus())
            && delegationService.canActFor(emp, line.getAssignedEmp()));
        boolean delegatedActedDecisionAssignee = lines.stream().anyMatch(line -> line.isDecisionLine() && isActedBy(line, emp));
        boolean receiver = lines.stream().anyMatch(line -> line.isReceiver() && line.isAssignedTo(emp));
        boolean shared = lines.stream().anyMatch(line -> (line.isReference() || line.isReader()) && line.isAssignedTo(emp));
        boolean auditAdmin = canViewAllDocuments(emp);
        boolean approved = ApprovalDocument.STATUS_APPROVED.equals(document.getStatus());
        boolean receiverRoutedHandoff = isReceiverRoutedDocument(document)
            && document.isPending()
            && lines.stream()
                .filter(ApprovalLine::isReceiver)
                .anyMatch(line -> ApprovalLine.STATUS_RECEIVED.equals(line.getStatus())
                    || ApprovalLine.STATUS_READ.equals(line.getStatus())
                    || ApprovalLine.STATUS_RECEIPT_COMPLETED.equals(line.getStatus()));
        boolean receiverRoutedReadyForReceiver = isReceiverRoutedReadyForReceiver(document, lines);
        boolean viewByPostApprovalRole = (approved || receiverRoutedHandoff) && (receiver || shared);
        boolean viewByReadyReceiver = receiverRoutedReadyForReceiver && receiver;
        boolean canView = requester || decisionAssignee || delegatedPendingDecisionAssignee || delegatedActedDecisionAssignee || viewByPostApprovalRole || auditAdmin;
        canView = canView || viewByReadyReceiver;
        boolean canPrintPdf = canView
            && approved
            && ApprovalDocument.PDF_STATUS_GENERATED.equals(document.getPdfStatus())
            && document.getPdfFile() != null;
        boolean pendingDecision = lines.stream().anyMatch(line -> line.isDecisionLine()
            && ApprovalLine.STATUS_PENDING.equals(line.getStatus())
            && (line.isPendingFor(emp) || delegationService.canActFor(emp, line.getAssignedEmp())));
        boolean canApprove = pendingDecision;
        boolean canReject = pendingDecision;
        boolean canWithdraw = requester
            && document.isPending()
            && lines.stream().filter(ApprovalLine::isDecisionLine).noneMatch(ApprovalLine::isActed);
        boolean canReceive = (approved || receiverRoutedHandoff || receiverRoutedReadyForReceiver) && lines.stream()
            .anyMatch(line -> line.isReceiver()
                && line.isAssignedTo(emp)
                && (ApprovalLine.STATUS_RECEIVED.equals(line.getStatus())
                    || (receiverRoutedReadyForReceiver && ApprovalLine.STATUS_WAITING.equals(line.getStatus()))));
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
            canPrintPdf,
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

    private boolean isActedBy(ApprovalLine line, Emp emp) {
        return emp != null && line.getActedEmp() != null && line.getActedEmp().getEmpId().equals(emp.getEmpId());
    }

    public boolean canManageOperations(Emp emp) {
        return emp != null && ("ADMIN".equals(emp.getRoleCode()) || "APPROVAL_ADMIN".equals(emp.getRoleCode()));
    }

    public boolean canViewAllDocuments(Emp emp) {
        return canManageOperations(emp) || (emp != null && "AUDIT_ADMIN".equals(emp.getRoleCode()));
    }

    private boolean isReceiverRoutedDocument(ApprovalDocument document) {
        return "PURCHASE".equals(document.getTemplateCode())
            || "TRAINING_REQUEST".equals(document.getTemplateCode())
            || "TRAINING_REPORT".equals(document.getTemplateCode());
    }

    private boolean isReceiverRoutedReadyForReceiver(ApprovalDocument document, List<ApprovalLine> lines) {
        return isReceiverRoutedDocument(document)
            && document.isPending()
            && lines.stream().anyMatch(ApprovalLine::isDecisionLine)
            && lines.stream()
                .filter(ApprovalLine::isDecisionLine)
                .allMatch(line -> ApprovalLine.STATUS_APPROVED.equals(line.getStatus())
                    || ApprovalLine.STATUS_SKIPPED.equals(line.getStatus()));
    }
}
