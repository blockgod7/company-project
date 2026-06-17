package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalActionRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalSummaryResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.response.PageResponse;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalService {

    private static final String BOX_REQUESTED = "requested";
    private static final String BOX_PENDING = "pending";
    private static final String BOX_PROCESSED = "processed";
    private static final String BOX_ALL = "all";

    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLineRepository lineRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;

    @Transactional(readOnly = true)
    public PageResponse<ApprovalSummaryResponse> findPage(String box, int page, int size) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
            Sort.by(Sort.Order.desc("approvalId")));
        String normalizedBox = box == null || box.isBlank() ? BOX_PENDING : box;

        if (BOX_PENDING.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findByApproverAndStatusOrderByLineIdDesc(currentEmp, ApprovalLine.STATUS_PENDING, pageRequest)
                .map(line -> summary(line.getDocument())));
        }
        if (BOX_PROCESSED.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findByApproverAndStatusInOrderByLineIdDesc(
                    currentEmp,
                    List.of(ApprovalLine.STATUS_APPROVED, ApprovalLine.STATUS_REJECTED),
                    pageRequest
                )
                .map(line -> summary(line.getDocument())));
        }
        if (BOX_REQUESTED.equals(normalizedBox)) {
            return PageResponse.from(documentRepository.findByRequesterAndDeletedYnOrderByApprovalIdDesc(currentEmp, "N", pageRequest)
                .map(this::summary));
        }
        if (BOX_ALL.equals(normalizedBox) && "ADMIN".equals(currentEmp.getRoleCode())) {
            return PageResponse.from(documentRepository.findByDeletedYnOrderByApprovalIdDesc("N", pageRequest).map(this::summary));
        }

        Page<ApprovalDocument> visible = documentRepository.findVisibleToApprover(currentEmp, pageRequest);
        return PageResponse.from(visible.map(this::summary));
    }

    @Transactional
    public ApprovalResponse create(ApprovalRequest request, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        List<Long> approverIds = request.approverEmpIds().stream().distinct().toList();
        if (approverIds.contains(requester.getEmpId())) {
            throw BusinessException.badRequest("APPROVAL_INVALID_LINE", "Requester cannot approve their own document");
        }

        ApprovalDocument document = documentRepository.save(ApprovalDocument.builder()
            .title(request.title())
            .content(request.content())
            .requester(requester)
            .build());

        for (int index = 0; index < approverIds.size(); index++) {
            Emp approver = empRepository.findById(approverIds.get(index))
                .orElseThrow(() -> BusinessException.notFound("APPROVER_NOT_FOUND", "Approver was not found"));
            lineRepository.save(ApprovalLine.builder()
                .document(document)
                .approver(approver)
                .lineOrder(index + 1)
                .first(index == 0)
                .build());
            if (index == 0) {
                notificationService.notifyEmp(approver.getEmpId(), "결재 요청", requester.getEmpName() + "님이 결재를 요청했습니다.", "APPROVAL", document.getApprovalId());
            }
        }

        auditLogService.record(requester.getEmpId(), AuditActionType.CREATE, "approval_document", document.getApprovalId(), ipAddress, userAgent);
        return findOne(document.getApprovalId());
    }

    @Transactional
    public ApprovalResponse findOne(Long approvalId) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getActiveDocument(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        assertReadable(currentEmp, document, lines);
        return ApprovalResponse.from(document, lines);
    }

    @Transactional
    public ApprovalResponse approve(Long approvalId, ApprovalActionRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getPendingDocument(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        ApprovalLine currentLine = lines.stream()
            .filter(line -> line.isPendingFor(currentEmp))
            .findFirst()
            .orElseThrow(() -> BusinessException.forbidden("APPROVAL_FORBIDDEN", "Only the current approver can approve this document"));

        currentLine.approve(request == null ? null : request.comment());
        ApprovalLine nextLine = lines.stream()
            .filter(line -> line.getLineOrder() > currentLine.getLineOrder())
            .filter(line -> ApprovalLine.STATUS_WAITING.equals(line.getStatus()))
            .findFirst()
            .orElse(null);
        if (nextLine == null) {
            document.approve();
            notificationService.notifyEmp(document.getRequester().getEmpId(), "결재 완료", document.getTitle() + " 문서가 승인되었습니다.", "APPROVAL", document.getApprovalId());
        } else {
            nextLine.open();
            notificationService.notifyEmp(nextLine.getApprover().getEmpId(), "결재 요청", document.getTitle() + " 문서의 결재 차례입니다.", "APPROVAL", document.getApprovalId());
        }

        auditLogService.record(currentEmp.getEmpId(), AuditActionType.UPDATE, "approval_document", document.getApprovalId(), ipAddress, userAgent);
        return ApprovalResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
    }

    @Transactional
    public ApprovalResponse reject(Long approvalId, ApprovalActionRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getPendingDocument(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        ApprovalLine currentLine = lines.stream()
            .filter(line -> line.isPendingFor(currentEmp))
            .findFirst()
            .orElseThrow(() -> BusinessException.forbidden("APPROVAL_FORBIDDEN", "Only the current approver can reject this document"));

        currentLine.reject(request == null ? null : request.comment());
        document.reject();
        notificationService.notifyEmp(document.getRequester().getEmpId(), "결재 반려", document.getTitle() + " 문서가 반려되었습니다.", "APPROVAL", document.getApprovalId());
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.UPDATE, "approval_document", document.getApprovalId(), ipAddress, userAgent);
        return ApprovalResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
    }

    private ApprovalSummaryResponse summary(ApprovalDocument document) {
        return ApprovalSummaryResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
    }

    private ApprovalDocument getActiveDocument(Long approvalId) {
        ApprovalDocument document = documentRepository.findById(approvalId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found"));
        if ("Y".equals(document.getDeletedYn())) {
            throw BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found");
        }
        return document;
    }

    private ApprovalDocument getPendingDocument(Long approvalId) {
        ApprovalDocument document = getActiveDocument(approvalId);
        if (!document.isPending()) {
            throw BusinessException.badRequest("APPROVAL_NOT_PENDING", "Approval document is not pending");
        }
        return document;
    }

    private void assertReadable(Emp currentEmp, ApprovalDocument document, List<ApprovalLine> lines) {
        boolean isRequester = document.getRequester().getEmpId().equals(currentEmp.getEmpId());
        boolean isApprover = lines.stream().anyMatch(line -> line.getApprover().getEmpId().equals(currentEmp.getEmpId()));
        boolean isAdmin = "ADMIN".equals(currentEmp.getRoleCode());
        if (!isRequester && !isApprover && !isAdmin) {
            throw BusinessException.forbidden("APPROVAL_FORBIDDEN", "You cannot access this approval document");
        }
    }
}
