package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalBoxResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalDashboardResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalSummaryResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.response.PageResponse;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalQueryService {

    private static final String BOX_REQUESTED = "requested";
    private static final String BOX_PENDING = "pending";
    private static final String BOX_AGREEMENT = "agreement";
    private static final String BOX_RECEIVED = "received";
    private static final String BOX_SHARED = "shared";
    private static final String BOX_PROCESSED = "processed";
    private static final String BOX_ALL = "all";
    private static final String DASHBOARD_ACTION_REQUIRED = "actionRequired";
    private static final String DASHBOARD_APPROVED_IN_PROGRESS = "approvedInProgress";
    private static final String DASHBOARD_MY_PENDING = "myPending";
    private static final String DASHBOARD_DELEGATED_PENDING = "delegatedPending";
    private static final String DASHBOARD_OVERDUE = "overdue";
    private static final String DASHBOARD_REQUESTED_IN_PROGRESS = "requestedInProgress";
    private static final String DASHBOARD_RECENT_COMPLETED = "recentCompleted";
    private static final String DASHBOARD_DRAFTS = "drafts";
    private static final String DASHBOARD_COMPLETED_INVOLVED = "completedInvolved";
    private static final List<String> APPROVAL_BOX_ORDER = List.of(
        BOX_AGREEMENT,
        BOX_PENDING,
        BOX_RECEIVED,
        BOX_SHARED,
        BOX_REQUESTED,
        BOX_PROCESSED,
        BOX_ALL
    );
    private static final Map<String, String> APPROVAL_BOX_LABELS = Map.of(
        BOX_AGREEMENT, "합의대기",
        BOX_PENDING, "결재대기",
        BOX_RECEIVED, "수신문서",
        BOX_SHARED, "참조/연람",
        BOX_REQUESTED, "기안문서",
        BOX_PROCESSED, "처리문서",
        BOX_ALL, "전체문서"
    );

    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLineRepository lineRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;
    private final ApprovalPermissionService permissionService;
    private final ApprovalDelegationService delegationService;

    @Transactional(readOnly = true)
    public List<ApprovalBoxResponse> boxes() {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        return APPROVAL_BOX_ORDER.stream()
            .filter(box -> !BOX_ALL.equals(box) || permissionService.canViewAllDocuments(currentEmp))
            .map(box -> new ApprovalBoxResponse(box, APPROVAL_BOX_LABELS.get(box)))
            .toList();
    }

    @Transactional(readOnly = true)
    public ApprovalDashboardResponse dashboard() {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        List<String> decisionTypes = List.of(ApprovalLine.TYPE_AGREEMENT, ApprovalLine.TYPE_APPROVAL);
        List<Emp> directAssignees = List.of(currentEmp);
        List<Emp> decisionAssignees = delegationService.decisionAssigneesFor(currentEmp);
        if (decisionAssignees == null || decisionAssignees.isEmpty()) {
            decisionAssignees = directAssignees;
        }
        List<Emp> delegatedAssignees = decisionAssignees.stream()
            .filter(emp -> emp != null && !emp.getEmpId().equals(currentEmp.getEmpId()))
            .toList();

        long myPendingCount = lineRepository.countByAssignedEmpInAndLineTypeInAndStatus(
            directAssignees,
            decisionTypes,
            ApprovalLine.STATUS_PENDING
        );
        long delegatedPendingCount = delegatedAssignees.isEmpty() ? 0 : lineRepository.countByAssignedEmpInAndLineTypeInAndStatus(
            delegatedAssignees,
            decisionTypes,
            ApprovalLine.STATUS_PENDING
        );
        long overdueCount = decisionAssignees.isEmpty() ? 0 : lineRepository.countOverdueByAssignedEmpIn(
            decisionAssignees,
            decisionTypes,
            ApprovalLine.STATUS_PENDING,
            LocalDateTime.now()
        );
        long requestedInProgressCount = documentRepository.countByRequesterAndDeletedYnAndStatus(
            currentEmp,
            "N",
            ApprovalDocument.STATUS_IN_PROGRESS
        );
        long recentCompletedCount = documentRepository.countByRequesterAndDeletedYnAndStatusInAndCompletedAtAfter(
            currentEmp,
            "N",
            List.of(ApprovalDocument.STATUS_APPROVED, ApprovalDocument.STATUS_REJECTED),
            LocalDateTime.now().minusDays(7)
        );
        return new ApprovalDashboardResponse(
            myPendingCount,
            delegatedPendingCount,
            overdueCount,
            requestedInProgressCount,
            recentCompletedCount
        );
    }

    @Transactional(readOnly = true)
    public PageResponse<ApprovalSummaryResponse> findPage(
        String box,
        int page,
        int size,
        String keyword,
        String templateCode,
        String status,
        Long requesterEmpId,
        LocalDate dateFrom,
        LocalDate dateTo,
        String dashboardFilter,
        String role
    ) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest documentPageRequest = PageRequest.of(safePage, safeSize, Sort.by(Sort.Order.desc("approvalId")));
        PageRequest linePageRequest = PageRequest.of(safePage, safeSize);
        String normalizedBox = box == null || box.isBlank() ? BOX_PENDING : box;
        validateBox(normalizedBox, currentEmp);
        if (DASHBOARD_COMPLETED_INVOLVED.equals(dashboardFilter)) {
            return findCompletedInvolvedPage(
                currentEmp,
                keyword,
                templateCode,
                status,
                requesterEmpId,
                dateFrom,
                dateTo,
                role,
                documentPageRequest
            );
        }
        if (hasText(dashboardFilter)) {
            return findDashboardPage(dashboardFilter, currentEmp, documentPageRequest, linePageRequest);
        }

        if (hasSearch(keyword, templateCode, status, requesterEmpId, dateFrom, dateTo)) {
            Emp requester = requesterEmpId == null ? null : empRepository.findById(requesterEmpId)
                .orElseThrow(() -> BusinessException.notFound("REQUESTER_NOT_FOUND", "Requester was not found"));
            LocalDateTime from = dateFrom == null ? null : dateFrom.atStartOfDay();
            LocalDateTime to = dateTo == null ? null : dateTo.plusDays(1).atStartOfDay();
            List<Emp> decisionAssignees = decisionAssigneesFor(currentEmp);
            return PageResponse.from(documentRepository.searchVisible(
                hasText(keyword),
                valueOrEmpty(keyword),
                hasText(templateCode),
                valueOrEmpty(templateCode),
                hasText(status),
                valueOrEmpty(status),
                requesterEmpId != null,
                requester == null ? currentEmp : requester,
                currentEmp,
                decisionAssignees,
                permissionService.canViewAllDocuments(currentEmp),
                BOX_AGREEMENT.equals(normalizedBox),
                BOX_PENDING.equals(normalizedBox),
                BOX_RECEIVED.equals(normalizedBox),
                BOX_SHARED.equals(normalizedBox),
                BOX_PROCESSED.equals(normalizedBox),
                BOX_REQUESTED.equals(normalizedBox),
                BOX_ALL.equals(normalizedBox),
                !BOX_AGREEMENT.equals(normalizedBox)
                    && !BOX_PENDING.equals(normalizedBox)
                    && !BOX_RECEIVED.equals(normalizedBox)
                    && !BOX_SHARED.equals(normalizedBox)
                    && !BOX_PROCESSED.equals(normalizedBox)
                    && !BOX_REQUESTED.equals(normalizedBox)
                    && !BOX_ALL.equals(normalizedBox),
                from != null,
                from == null ? LocalDateTime.now() : from,
                to != null,
                to == null ? LocalDateTime.now() : to,
                documentPageRequest
            ).map(this::summary));
        }

        if (BOX_AGREEMENT.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findByAssignedEmpInAndLineTypeAndStatusOrderByLineIdDesc(
                decisionAssigneesFor(currentEmp),
                ApprovalLine.TYPE_AGREEMENT,
                ApprovalLine.STATUS_PENDING,
                linePageRequest
            ).map(line -> summary(line.getDocument())));
        }
        if (BOX_PENDING.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findByAssignedEmpInAndLineTypeAndStatusOrderByLineIdDesc(
                decisionAssigneesFor(currentEmp),
                ApprovalLine.TYPE_APPROVAL,
                ApprovalLine.STATUS_PENDING,
                linePageRequest
            ).map(line -> summary(line.getDocument())));
        }
        if (BOX_RECEIVED.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findOpenReceiverInboxLines(currentEmp, linePageRequest)
                .map(line -> summary(line.getDocument())));
        }
        if (BOX_SHARED.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findByAssignedEmpAndLineTypeInAndStatusInOrderByLineIdDesc(
                currentEmp,
                List.of(ApprovalLine.TYPE_REFERENCE, ApprovalLine.TYPE_READER),
                List.of(ApprovalLine.STATUS_READ),
                linePageRequest
            ).map(line -> summary(line.getDocument())));
        }
        if (BOX_PROCESSED.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findByAssignedEmpInAndStatusInOrderByLineIdDesc(
                decisionAssigneesFor(currentEmp),
                List.of(ApprovalLine.STATUS_APPROVED, ApprovalLine.STATUS_REJECTED, ApprovalLine.STATUS_RECEIPT_COMPLETED),
                linePageRequest
            ).map(line -> summary(line.getDocument())));
        }
        if (BOX_REQUESTED.equals(normalizedBox)) {
            return PageResponse.from(documentRepository.findByRequesterAndDeletedYnOrderByApprovalIdDesc(currentEmp, "N", documentPageRequest)
                .map(this::summary));
        }
        if (BOX_ALL.equals(normalizedBox) && permissionService.canViewAllDocuments(currentEmp)) {
            return PageResponse.from(documentRepository.findByDeletedYnOrderByApprovalIdDesc("N", documentPageRequest).map(this::summary));
        }

        Page<ApprovalDocument> visible = documentRepository.findVisibleToApprover(currentEmp, documentPageRequest);
        return PageResponse.from(visible.map(this::summary));
    }

    @Transactional
    public ApprovalResponse findOne(Long approvalId, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getActiveDocument(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        try {
            permissionService.assertCanView(currentEmp, document, lines);
            auditApproval(currentEmp, AuditActionType.READ, document, "문서 조회", true, ipAddress, userAgent);
            return response(document, lines, currentEmp);
        } catch (BusinessException ex) {
            auditApproval(currentEmp, AuditActionType.ACCESS_DENIED, document, "문서 조회 권한 없음", false, ipAddress, userAgent);
            throw ex;
        }
    }

    @Transactional(readOnly = true)
    public PageResponse<ApprovalSummaryResponse> deletedPage(int page, int size) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        if (!permissionService.canManageOperations(currentEmp)) {
            throw BusinessException.forbidden("APPROVAL_DELETED_VIEW_FORBIDDEN", "전자결재 관리자만 보존삭제 문서를 조회할 수 있습니다.");
        }
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, Sort.by(Sort.Order.desc("deletedAt"), Sort.Order.desc("approvalId")));
        return PageResponse.from(documentRepository.findByDeletedYn("Y", pageRequest).map(this::summary));
    }

    private PageResponse<ApprovalSummaryResponse> findDashboardPage(
        String dashboardFilter,
        Emp currentEmp,
        PageRequest documentPageRequest,
        PageRequest linePageRequest
    ) {
        List<String> decisionTypes = List.of(ApprovalLine.TYPE_AGREEMENT, ApprovalLine.TYPE_APPROVAL);
        List<Emp> foundDecisionAssignees = delegationService.decisionAssigneesFor(currentEmp);
        List<Emp> decisionAssignees = foundDecisionAssignees == null || foundDecisionAssignees.isEmpty()
            ? List.of(currentEmp)
            : foundDecisionAssignees;
        return switch (dashboardFilter) {
            case DASHBOARD_ACTION_REQUIRED -> PageResponse.from(documentRepository.findActionRequiredDocuments(
                decisionAssignees,
                currentEmp,
                documentPageRequest
            ).map(this::summary));
            case DASHBOARD_APPROVED_IN_PROGRESS -> PageResponse.from(documentRepository.findApprovalInProgressForMe(
                currentEmp,
                documentPageRequest
            ).map(this::summary));
            case DASHBOARD_DRAFTS -> PageResponse.from(documentRepository.findByRequesterAndDeletedYnAndStatusOrderByApprovalIdDesc(
                currentEmp,
                "N",
                ApprovalDocument.STATUS_DRAFT,
                documentPageRequest
            ).map(this::summary));
            case DASHBOARD_MY_PENDING -> PageResponse.from(lineRepository.findByAssignedEmpInAndLineTypeInAndStatusOrderByLineIdDesc(
                List.of(currentEmp),
                decisionTypes,
                ApprovalLine.STATUS_PENDING,
                linePageRequest
            ).map(line -> summary(line.getDocument())));
            case DASHBOARD_DELEGATED_PENDING -> {
                List<Emp> delegatedAssignees = decisionAssignees.stream()
                    .filter(emp -> emp != null && !emp.getEmpId().equals(currentEmp.getEmpId()))
                    .toList();
                yield delegatedAssignees.isEmpty()
                    ? PageResponse.from(Page.<ApprovalLine>empty(linePageRequest).map(line -> summary(line.getDocument())))
                    : PageResponse.from(lineRepository.findByAssignedEmpInAndLineTypeInAndStatusOrderByLineIdDesc(
                        delegatedAssignees,
                        decisionTypes,
                        ApprovalLine.STATUS_PENDING,
                        linePageRequest
                    ).map(line -> summary(line.getDocument())));
            }
            case DASHBOARD_OVERDUE -> PageResponse.from(lineRepository.findOverdueByAssignedEmpIn(
                decisionAssignees,
                decisionTypes,
                ApprovalLine.STATUS_PENDING,
                LocalDateTime.now(),
                linePageRequest
            ).map(line -> summary(line.getDocument())));
            case DASHBOARD_REQUESTED_IN_PROGRESS -> PageResponse.from(documentRepository.findByRequesterAndDeletedYnAndStatusOrderByApprovalIdDesc(
                currentEmp,
                "N",
                ApprovalDocument.STATUS_IN_PROGRESS,
                documentPageRequest
            ).map(this::summary));
            case DASHBOARD_RECENT_COMPLETED -> PageResponse.from(documentRepository.findByRequesterAndDeletedYnAndStatusInAndCompletedAtAfterOrderByCompletedAtDesc(
                currentEmp,
                "N",
                List.of(ApprovalDocument.STATUS_APPROVED, ApprovalDocument.STATUS_REJECTED),
                LocalDateTime.now().minusDays(7),
                documentPageRequest
            ).map(this::summary));
            default -> throw BusinessException.badRequest("APPROVAL_DASHBOARD_FILTER_INVALID", "지원하지 않는 대시보드 필터입니다.");
        };
    }

    private List<Emp> decisionAssigneesFor(Emp currentEmp) {
        List<Emp> found = delegationService.decisionAssigneesFor(currentEmp);
        return found == null || found.isEmpty() ? List.of(currentEmp) : found;
    }

    private PageResponse<ApprovalSummaryResponse> findCompletedInvolvedPage(
        Emp currentEmp,
        String keyword,
        String templateCode,
        String status,
        Long requesterEmpId,
        LocalDate dateFrom,
        LocalDate dateTo,
        String role,
        PageRequest pageRequest
    ) {
        Emp requester = requesterEmpId == null ? null : empRepository.findById(requesterEmpId)
            .orElseThrow(() -> BusinessException.notFound("REQUESTER_NOT_FOUND", "Requester was not found"));
        LocalDateTime from = dateFrom == null ? null : dateFrom.atStartOfDay();
        LocalDateTime to = dateTo == null ? null : dateTo.plusDays(1).atStartOfDay();
        String normalizedRole = hasText(role) ? role.trim().toUpperCase() : "ALL";
        return PageResponse.from(documentRepository.findCompletedInvolved(
            hasText(keyword),
            valueOrEmpty(keyword),
            hasText(templateCode),
            valueOrEmpty(templateCode),
            hasText(status),
            valueOrEmpty(status),
            requesterEmpId != null,
            requester == null ? currentEmp : requester,
            currentEmp,
            normalizedRole,
            from != null,
            from == null ? LocalDateTime.now() : from,
            to != null,
            to == null ? LocalDateTime.now() : to,
            pageRequest
        ).map(this::summary));
    }

    private ApprovalSummaryResponse summary(ApprovalDocument document) {
        return ApprovalSummaryResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
    }

    private ApprovalResponse response(ApprovalDocument document, List<ApprovalLine> lines, Emp currentEmp) {
        return ApprovalResponse.from(document, lines, permissionService.permissions(currentEmp, document, lines));
    }

    private void validateBox(String box, Emp currentEmp) {
        if (!APPROVAL_BOX_LABELS.containsKey(box)) {
            throw BusinessException.badRequest("APPROVAL_BOX_INVALID", "지원하지 않는 전자결재 문서함입니다.");
        }
        if (BOX_ALL.equals(box) && !permissionService.canViewAllDocuments(currentEmp)) {
            throw BusinessException.forbidden("APPROVAL_BOX_FORBIDDEN", "전체문서 문서함을 조회할 권한이 없습니다.");
        }
    }

    private ApprovalDocument getActiveDocument(Long approvalId) {
        ApprovalDocument document = documentRepository.findById(approvalId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found"));
        if ("Y".equals(document.getDeletedYn())) {
            throw BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found");
        }
        return document;
    }

    private void auditApproval(
        Emp emp,
        AuditActionType actionType,
        ApprovalDocument document,
        String reason,
        boolean success,
        String ipAddress,
        String userAgent
    ) {
        auditLogService.record(
            emp == null ? null : emp.getEmpId(),
            actionType,
            "approval_document",
            document.getApprovalId(),
            null,
            null,
            ipAddress,
            userAgent,
            reason,
            success
        );
    }

    private boolean hasSearch(String keyword, String templateCode, String status, Long requesterEmpId, LocalDate dateFrom, LocalDate dateTo) {
        return hasText(keyword) || hasText(templateCode) || hasText(status) || requesterEmpId != null || dateFrom != null || dateTo != null;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String blankToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private String valueOrEmpty(String value) {
        return hasText(value) ? value.trim() : "";
    }
}
