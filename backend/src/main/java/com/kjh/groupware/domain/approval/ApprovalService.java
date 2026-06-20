package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.ApprovalActionRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalSummaryResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.emp.EmpSignatureService;
import com.kjh.groupware.domain.file.AttachFile;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.response.PageResponse;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalService {

    private static final String BOX_REQUESTED = "requested";
    private static final String BOX_PENDING = "pending";
    private static final String BOX_AGREEMENT = "agreement";
    private static final String BOX_RECEIVED = "received";
    private static final String BOX_SHARED = "shared";
    private static final String BOX_PROCESSED = "processed";
    private static final String BOX_ALL = "all";

    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLineRepository lineRepository;
    private final ApprovalTemplateRepository templateRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final EmpSignatureService signatureService;
    private final ApprovalPdfService pdfService;
    private final ApprovalPermissionService permissionService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

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
        LocalDate dateTo
    ) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        PageRequest documentPageRequest = PageRequest.of(safePage, safeSize, Sort.by(Sort.Order.desc("approvalId")));
        PageRequest linePageRequest = PageRequest.of(safePage, safeSize);
        String normalizedBox = box == null || box.isBlank() ? BOX_PENDING : box;

        if (hasSearch(keyword, templateCode, status, requesterEmpId, dateFrom, dateTo)) {
            Emp requester = requesterEmpId == null ? null : empRepository.findById(requesterEmpId)
                .orElseThrow(() -> BusinessException.notFound("REQUESTER_NOT_FOUND", "Requester was not found"));
            LocalDateTime from = dateFrom == null ? null : dateFrom.atStartOfDay();
            LocalDateTime to = dateTo == null ? null : dateTo.plusDays(1).atStartOfDay();
            return PageResponse.from(documentRepository.searchVisible(
                blankToNull(keyword),
                blankToNull(templateCode),
                blankToNull(status),
                requester,
                currentEmp,
                "ADMIN".equals(currentEmp.getRoleCode()),
                from,
                to,
                documentPageRequest
            ).map(this::summary));
        }

        if (BOX_AGREEMENT.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findByAssignedEmpAndLineTypeAndStatusOrderByLineIdDesc(
                currentEmp,
                ApprovalLine.TYPE_AGREEMENT,
                ApprovalLine.STATUS_PENDING,
                linePageRequest
            ).map(line -> summary(line.getDocument())));
        }
        if (BOX_PENDING.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findByAssignedEmpAndLineTypeAndStatusOrderByLineIdDesc(
                currentEmp,
                ApprovalLine.TYPE_APPROVAL,
                ApprovalLine.STATUS_PENDING,
                linePageRequest
            ).map(line -> summary(line.getDocument())));
        }
        if (BOX_RECEIVED.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findByAssignedEmpAndLineTypeInAndStatusInOrderByLineIdDesc(
                currentEmp,
                List.of(ApprovalLine.TYPE_RECEIVER),
                List.of(ApprovalLine.STATUS_RECEIVED, ApprovalLine.STATUS_READ, ApprovalLine.STATUS_RECEIPT_COMPLETED),
                linePageRequest
            ).map(line -> summary(line.getDocument())));
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
            return PageResponse.from(lineRepository.findByAssignedEmpAndStatusInOrderByLineIdDesc(
                currentEmp,
                List.of(ApprovalLine.STATUS_APPROVED, ApprovalLine.STATUS_REJECTED, ApprovalLine.STATUS_RECEIPT_COMPLETED),
                linePageRequest
            ).map(line -> summary(line.getDocument())));
        }
        if (BOX_REQUESTED.equals(normalizedBox)) {
            return PageResponse.from(documentRepository.findByRequesterAndDeletedYnOrderByApprovalIdDesc(currentEmp, "N", documentPageRequest)
                .map(this::summary));
        }
        if (BOX_ALL.equals(normalizedBox) && "ADMIN".equals(currentEmp.getRoleCode())) {
            return PageResponse.from(documentRepository.findByDeletedYnOrderByApprovalIdDesc("N", documentPageRequest).map(this::summary));
        }

        Page<ApprovalDocument> visible = documentRepository.findVisibleToApprover(currentEmp, documentPageRequest);
        return PageResponse.from(visible.map(this::summary));
    }

    @Transactional
    public ApprovalResponse create(ApprovalRequest request, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalTemplate template = activeTemplate(request.templateCode());
        boolean draft = Boolean.TRUE.equals(request.draft());
        validateLineSelection(requester, request, !draft);

        String title = hasText(request.title()) ? request.title() : template.getTemplateName();
        String content = request.content() == null ? summarizeFormData(request.formDataJson()) : request.content();
        String documentNo = draft ? null : generateDocumentNo(template.getTemplateCode());
        ApprovalDocument document = documentRepository.save(ApprovalDocument.builder()
            .documentNo(documentNo)
            .title(title)
            .content(content)
            .templateCode(template.getTemplateCode())
            .templateVersion(template.getVersion())
            .templateSnapshotJson(templateSnapshot(template))
            .formDataJson(request.formDataJson())
            .searchText(buildSearchText(documentNo, title, requester, template, request.formDataJson()))
            .priority(request.priority())
            .requester(requester)
            .build());

        if (draft) {
            document.saveAsDraft();
            createLines(document, request, false);
        } else {
            createLines(document, request, true);
            document.submit(documentNo, buildSearchText(documentNo, title, requester, template, request.formDataJson()), hasAgreement(request));
            notifyInitialPendingLines(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), requester);
        }

        auditApproval(requester, draft ? AuditActionType.CREATE : AuditActionType.SUBMIT, document, draft ? "임시저장" : "상신", true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), requester);
    }

    @Transactional
    public ApprovalResponse createDraft(ApprovalRequest request, String ipAddress, String userAgent) {
        ApprovalRequest draftRequest = new ApprovalRequest(
            request.title(),
            request.content(),
            request.templateCode(),
            request.formDataJson(),
            request.priority(),
            request.agreementEmpIds(),
            request.approverEmpIds(),
            request.receiverEmpIds(),
            request.referenceEmpIds(),
            request.readerEmpIds(),
            true
        );
        return create(draftRequest, ipAddress, userAgent);
    }

    @Transactional
    public ApprovalResponse updateDraft(Long approvalId, ApprovalRequest request, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getActiveDocumentForUpdate(approvalId);
        assertRequester(requester, document);
        if (!document.isEditableDraft()) {
            throw BusinessException.badRequest("APPROVAL_NOT_EDITABLE", "수정할 수 없는 문서입니다.");
        }
        validateLineSelection(requester, request, false);

        ApprovalTemplate template = activeTemplate(request.templateCode());
        String title = hasText(request.title()) ? request.title() : template.getTemplateName();
        String content = request.content() == null ? summarizeFormData(request.formDataJson()) : request.content();
        document.updateDraft(
            title,
            content,
            template.getTemplateCode(),
            template.getVersion(),
            templateSnapshot(template),
            request.formDataJson(),
            buildSearchText(document.getDocumentNo(), title, requester, template, request.formDataJson()),
            request.priority()
        );
        document.saveAsDraft();
        lineRepository.deleteByDocument(document);
        createLines(document, request, false);
        auditApproval(requester, AuditActionType.UPDATE, document, "결재선 변경", true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), requester);
    }

    @Transactional
    public ApprovalResponse submit(Long approvalId, ApprovalRequest request, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getActiveDocumentForUpdate(approvalId);
        assertRequester(requester, document);
        if (!document.isEditableDraft()) {
            throw BusinessException.badRequest("APPROVAL_ALREADY_SUBMITTED", "이미 처리된 문서입니다.");
        }
        validateLineSelection(requester, request, true);

        ApprovalTemplate template = activeTemplate(request.templateCode());
        String title = hasText(request.title()) ? request.title() : template.getTemplateName();
        String content = request.content() == null ? summarizeFormData(request.formDataJson()) : request.content();
        String documentNo = hasText(document.getDocumentNo()) ? document.getDocumentNo() : generateDocumentNo(template.getTemplateCode());
        document.updateDraft(
            title,
            content,
            template.getTemplateCode(),
            template.getVersion(),
            templateSnapshot(template),
            request.formDataJson(),
            buildSearchText(documentNo, title, requester, template, request.formDataJson()),
            request.priority()
        );
        lineRepository.deleteByDocument(document);
        createLines(document, request, true);
        document.submit(documentNo, buildSearchText(documentNo, title, requester, template, request.formDataJson()), hasAgreement(request));
        notifyInitialPendingLines(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), requester);
        auditApproval(requester, AuditActionType.SUBMIT, document, "상신", true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), requester);
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

    @Transactional
    public ApprovalResponse approve(Long approvalId, ApprovalActionRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getPendingDocumentForUpdate(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        ApprovalLine currentLine = currentDecisionLineForUpdate(lines, currentEmp);

        AttachFile signatureFile = currentLine.isApproval() ? signatureService.activeSignatureFile(currentEmp) : null;
        currentLine.approve(request == null ? null : request.comment(), signatureFile, signatureService.snapshotJson(currentEmp));

        if (currentLine.isAgreement()) {
            progressAfterAgreement(document, lines);
        } else {
            progressAfterApproval(document, lines, currentLine);
        }
        notifyPreviousApprovers(document, lines, currentLine, "전자결재 진행", "결재가 승인되어 다음 결재자에게 전달되었습니다.");
        auditApproval(currentEmp, currentLine.isAgreement() ? AuditActionType.AGREE : AuditActionType.APPROVE, document, request == null ? null : request.comment(), true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), currentEmp);
    }

    @Transactional
    public ApprovalResponse reject(Long approvalId, ApprovalActionRequest request, String ipAddress, String userAgent) {
        String comment = request == null ? null : request.comment();
        if (!hasText(comment)) {
            throw BusinessException.badRequest("APPROVAL_REJECT_REASON_REQUIRED", "반려 사유를 입력해 주세요.");
        }
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getPendingDocumentForUpdate(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        ApprovalLine currentLine = currentDecisionLineForUpdate(lines, currentEmp);

        currentLine.reject(comment);
        lines.stream()
            .filter(line -> !line.getLineId().equals(currentLine.getLineId()))
            .filter(line -> !line.isActed())
            .filter(line -> !ApprovalLine.STATUS_SKIPPED.equals(line.getStatus()))
            .forEach(line -> line.skip("REJECTED"));
        document.reject();
        notificationService.notifyEmp(document.getRequester().getEmpId(), "전자결재 반려", "상신한 문서가 반려되었습니다.", "APPROVAL", document.getApprovalId());
        notifyPreviousApprovers(document, lines, currentLine, "전자결재 반려", "상신한 문서가 반려되었습니다.");
        auditApproval(currentEmp, AuditActionType.REJECT, document, comment, true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), currentEmp);
    }

    @Transactional
    public ApprovalResponse withdraw(Long approvalId, ApprovalActionRequest request, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getPendingDocumentForUpdate(approvalId);
        assertRequester(requester, document);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        if (lines.stream().filter(ApprovalLine::isDecisionLine).anyMatch(ApprovalLine::isActed)) {
            throw BusinessException.badRequest("APPROVAL_ALREADY_ACTED", "회수할 수 없는 문서입니다.");
        }
        lines.forEach(line -> line.skip("WITHDRAWN"));
        document.withdraw(request == null ? null : request.comment());
        auditApproval(requester, AuditActionType.WITHDRAW, document, request == null ? null : request.comment(), true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), requester);
    }

    @Transactional
    public ApprovalResponse cancel(Long approvalId, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getActiveDocumentForUpdate(approvalId);
        assertRequester(requester, document);
        if (!document.isDraft()) {
            throw BusinessException.badRequest("APPROVAL_CANCEL_ONLY_DRAFT", "취소는 임시저장 문서에만 가능합니다.");
        }
        lineRepository.findByDocumentOrderByLineOrderAsc(document).forEach(line -> line.skip("CANCELED"));
        document.cancel();
        auditApproval(requester, AuditActionType.CANCEL, document, "취소", true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), requester);
    }

    @Transactional
    public ApprovalResponse redraft(Long approvalId, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalDocument source = getActiveDocument(approvalId);
        assertRequester(requester, source);
        if (!ApprovalDocument.STATUS_REJECTED.equals(source.getStatus())) {
            throw BusinessException.badRequest("APPROVAL_CANNOT_REDRAFT", "반려 문서만 재상신할 수 있습니다.");
        }
        ApprovalTemplate template = activeTemplate(source.getTemplateCode());
        ApprovalDocument copy = documentRepository.save(ApprovalDocument.builder()
            .documentNo(null)
            .title(source.getTitle())
            .content(source.getContent())
            .templateCode(template.getTemplateCode())
            .templateVersion(template.getVersion())
            .templateSnapshotJson(templateSnapshot(template))
            .formDataJson(source.getFormDataJson())
            .searchText(buildSearchText(null, source.getTitle(), requester, template, source.getFormDataJson()))
            .priority(source.getPriority())
            .originDocument(source)
            .revisionNo(source.getRevisionNo() == null ? 1 : source.getRevisionNo() + 1)
            .resubmitReason("REJECTED_REDRAFT")
            .requester(requester)
            .build());
        copy.saveAsDraft();
        auditApproval(requester, AuditActionType.REDRAFT, copy, "반려 문서 재상신 초안 생성", true, ipAddress, userAgent);
        return response(copy, List.of(), requester);
    }

    @Transactional
    public ApprovalResponse receive(Long approvalId, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getApprovedDocumentForUpdate(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        ApprovalLine receiverLine = receiverLineForUpdate(lines, currentEmp);
        if (!ApprovalLine.STATUS_RECEIVED.equals(receiverLine.getStatus())) {
            throw BusinessException.badRequest("APPROVAL_RECEIVE_DUPLICATED", "이미 처리된 문서입니다.");
        }
        receiverLine.markRead();
        auditApproval(currentEmp, AuditActionType.RECEIVE, document, "수신 확인", true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), currentEmp);
    }

    @Transactional
    public ApprovalResponse completeReceipt(Long approvalId, ApprovalActionRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getApprovedDocumentForUpdate(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        ApprovalLine receiverLine = receiverLineForUpdate(lines, currentEmp);
        if (!ApprovalLine.STATUS_RECEIVED.equals(receiverLine.getStatus()) && !ApprovalLine.STATUS_READ.equals(receiverLine.getStatus())) {
            throw BusinessException.badRequest("APPROVAL_RECEIPT_DUPLICATED", "이미 처리된 문서입니다.");
        }
        receiverLine.completeReceipt(request == null ? null : request.comment());
        auditApproval(currentEmp, AuditActionType.COMPLETE_RECEIPT, document, request == null ? null : request.comment(), true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), currentEmp);
    }

    @Transactional
    public ApprovalResponse regeneratePdf(Long approvalId, ApprovalActionRequest request) {
        ApprovalDocument document = pdfService.regenerate(approvalId, request == null ? null : request.comment());
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), currentEmpProvider.getCurrentEmp());
    }

    private void progressAfterAgreement(ApprovalDocument document, List<ApprovalLine> lines) {
        boolean allAgreed = lines.stream()
            .filter(ApprovalLine::isAgreement)
            .allMatch(line -> ApprovalLine.STATUS_APPROVED.equals(line.getStatus()));
        if (!allAgreed) {
            return;
        }
        ApprovalLine firstApprover = lines.stream()
            .filter(ApprovalLine::isApproval)
            .filter(line -> ApprovalLine.STATUS_WAITING.equals(line.getStatus()))
            .findFirst()
            .orElseThrow(() -> BusinessException.badRequest("APPROVAL_INVALID_LINE", "Approver line is missing"));
        firstApprover.open();
        document.moveToApprovalProgress();
        notificationService.notifyEmp(firstApprover.getAssignedEmp().getEmpId(), "전자결재 요청", "합의가 완료되어 결재 단계로 전달되었습니다.", "APPROVAL", document.getApprovalId());
    }

    private void progressAfterApproval(ApprovalDocument document, List<ApprovalLine> lines, ApprovalLine currentLine) {
        ApprovalLine nextApprover = lines.stream()
            .filter(ApprovalLine::isApproval)
            .filter(line -> line.getLineOrder() > currentLine.getLineOrder())
            .filter(line -> ApprovalLine.STATUS_WAITING.equals(line.getStatus()))
            .findFirst()
            .orElse(null);
        if (nextApprover != null) {
            nextApprover.open();
            notificationService.notifyEmp(nextApprover.getAssignedEmp().getEmpId(), "전자결재 요청", "결재 요청 문서가 도착했습니다.", "APPROVAL", document.getApprovalId());
            return;
        }
        document.approve();
        openPostApprovalLines(document, lines);
        notificationService.notifyEmp(document.getRequester().getEmpId(), "전자결재 완료", "상신한 문서가 최종 승인되었습니다.", "APPROVAL", document.getApprovalId());
    }

    private void openPostApprovalLines(ApprovalDocument document, List<ApprovalLine> lines) {
        lines.stream()
            .filter(line -> ApprovalLine.STATUS_WAITING.equals(line.getStatus()))
            .forEach(line -> {
                if (line.isReceiver()) {
                    line.markReceived();
                    notificationService.notifyEmp(line.getAssignedEmp().getEmpId(), "수신 문서 도착", "수신 문서가 도착했습니다.", "APPROVAL", document.getApprovalId());
                } else if (line.isReference()) {
                    line.openShared();
                    notificationService.notifyEmp(line.getAssignedEmp().getEmpId(), "참조 문서 도착", "참조 문서가 도착했습니다.", "APPROVAL", document.getApprovalId());
                } else if (line.isReader()) {
                    line.openShared();
                }
            });
    }

    private ApprovalSummaryResponse summary(ApprovalDocument document) {
        return ApprovalSummaryResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
    }

    private ApprovalResponse response(ApprovalDocument document, List<ApprovalLine> lines, Emp currentEmp) {
        return ApprovalResponse.from(document, lines, permissionService.permissions(currentEmp, document, lines));
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
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("approvalId", document.getApprovalId());
        payload.put("documentNo", document.getDocumentNo());
        payload.put("userId", emp == null ? null : emp.getEmpId());
        payload.put("userName", emp == null ? null : emp.getEmpName());
        payload.put("status", document.getStatus());
        payload.put("currentStage", document.getCurrentStage());
        auditLogService.record(
            emp == null ? null : emp.getEmpId(),
            actionType,
            "approval_document",
            document.getApprovalId(),
            null,
            objectMapper.valueToTree(payload),
            ipAddress,
            userAgent,
            reason,
            success
        );
    }

    private ApprovalTemplate activeTemplate(String templateCode) {
        return templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(templateCode, "Y")
            .orElseThrow(() -> BusinessException.badRequest("APPROVAL_TEMPLATE_NOT_FOUND", "Active approval template was not found"));
    }

    private ApprovalDocument getActiveDocument(Long approvalId) {
        ApprovalDocument document = documentRepository.findById(approvalId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found"));
        if ("Y".equals(document.getDeletedYn())) {
            throw BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found");
        }
        return document;
    }

    private ApprovalDocument getActiveDocumentForUpdate(Long approvalId) {
        ApprovalDocument document = documentRepository.findByIdForUpdate(approvalId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found"));
        if ("Y".equals(document.getDeletedYn())) {
            throw BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found");
        }
        return document;
    }

    private ApprovalDocument getPendingDocumentForUpdate(Long approvalId) {
        ApprovalDocument document = getActiveDocumentForUpdate(approvalId);
        if (!document.isPending()) {
            throw BusinessException.badRequest("APPROVAL_NOT_PENDING", "Approval document is not in progress");
        }
        return document;
    }

    private ApprovalDocument getApprovedDocumentForUpdate(Long approvalId) {
        ApprovalDocument document = getActiveDocumentForUpdate(approvalId);
        if (!ApprovalDocument.STATUS_APPROVED.equals(document.getStatus())) {
            throw BusinessException.badRequest("APPROVAL_NOT_APPROVED", "Only approved documents can be received");
        }
        return document;
    }

    private ApprovalLine currentDecisionLineForUpdate(List<ApprovalLine> lines, Emp currentEmp) {
        ApprovalLine candidate = lines.stream()
            .filter(ApprovalLine::isDecisionLine)
            .filter(line -> line.isPendingFor(currentEmp))
            .findFirst()
            .orElseThrow(() -> BusinessException.forbidden("APPROVAL_FORBIDDEN", "Only the current agreement or approver can process this document"));
        ApprovalLine locked = lineRepository.findByIdForUpdate(candidate.getLineId())
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_LINE_NOT_FOUND", "Approval line was not found"));
        if (!locked.isDecisionLine() || !locked.isPendingFor(currentEmp)) {
            throw BusinessException.badRequest("APPROVAL_ALREADY_PROCESSED", "This approval line has already been processed");
        }
        return locked;
    }

    private ApprovalLine receiverLineForUpdate(List<ApprovalLine> lines, Emp currentEmp) {
        ApprovalLine candidate = lines.stream()
            .filter(ApprovalLine::isReceiver)
            .filter(line -> line.isAssignedTo(currentEmp))
            .findFirst()
            .orElseThrow(() -> BusinessException.forbidden("APPROVAL_RECEIVER_FORBIDDEN", "Only the receiver can process this receipt"));
        ApprovalLine locked = lineRepository.findByIdForUpdate(candidate.getLineId())
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_LINE_NOT_FOUND", "Approval line was not found"));
        if (!locked.isReceiver() || !locked.isAssignedTo(currentEmp)) {
            throw BusinessException.forbidden("APPROVAL_RECEIVER_FORBIDDEN", "Only the receiver can process this receipt");
        }
        return locked;
    }

    private void assertReadable(Emp currentEmp, ApprovalDocument document, List<ApprovalLine> lines) {
        boolean isRequester = document.getRequester().getEmpId().equals(currentEmp.getEmpId());
        boolean isAssignee = lines.stream().anyMatch(line -> line.isAssignedTo(currentEmp));
        boolean isAdmin = "ADMIN".equals(currentEmp.getRoleCode());
        if (!isRequester && !isAssignee && !isAdmin) {
            throw BusinessException.forbidden("APPROVAL_FORBIDDEN", "You cannot access this approval document");
        }
    }

    private void assertRequester(Emp currentEmp, ApprovalDocument document) {
        if (!document.getRequester().getEmpId().equals(currentEmp.getEmpId())) {
            throw BusinessException.forbidden("APPROVAL_FORBIDDEN", "Only the requester can change this approval document");
        }
    }

    private void validateLineSelection(Emp requester, ApprovalRequest request, boolean requireApprover) {
        List<Long> agreementIds = ids(request.agreementEmpIds());
        List<Long> approverIds = ids(request.approverEmpIds());
        List<Long> receiverIds = ids(request.receiverEmpIds());
        requireNoDuplicate("AGREEMENT", agreementIds);
        requireNoDuplicate("APPROVAL", approverIds);
        requireNoDuplicate("RECEIVER", receiverIds);
        if (requireApprover && approverIds.isEmpty()) {
            throw BusinessException.badRequest("APPROVAL_INVALID_LINE", "At least one approver is required");
        }
        if (agreementIds.contains(requester.getEmpId()) || approverIds.contains(requester.getEmpId())) {
            throw BusinessException.badRequest("APPROVAL_INVALID_LINE", "Requester cannot be an agreement or approval assignee");
        }
        Set<Long> decisionAndReceiverIds = new HashSet<>();
        for (Long empId : concat(agreementIds, approverIds, receiverIds)) {
            if (!decisionAndReceiverIds.add(empId)) {
                throw BusinessException.badRequest("APPROVAL_INVALID_LINE", "Agreement, approval, and receiver assignees cannot overlap");
            }
        }
    }

    private void requireNoDuplicate(String lineType, List<Long> empIds) {
        if (new HashSet<>(empIds).size() != empIds.size()) {
            throw BusinessException.badRequest("APPROVAL_INVALID_LINE", lineType + " assignees cannot contain duplicates");
        }
    }

    private List<Long> concat(List<Long> first, List<Long> second, List<Long> third) {
        List<Long> result = new ArrayList<>(first);
        result.addAll(second);
        result.addAll(third);
        return result;
    }

    private void createLines(ApprovalDocument document, ApprovalRequest request, boolean submitted) {
        int order = 1;
        boolean hasAgreement = hasAgreement(request);
        order = createTypedLines(document, ids(request.agreementEmpIds()), ApprovalLine.TYPE_AGREEMENT, order, submitted);
        order = createTypedLines(document, ids(request.approverEmpIds()), ApprovalLine.TYPE_APPROVAL, order, submitted && !hasAgreement);
        order = createTypedLines(document, ids(request.receiverEmpIds()), ApprovalLine.TYPE_RECEIVER, order, false);
        order = createTypedLines(document, ids(request.referenceEmpIds()), ApprovalLine.TYPE_REFERENCE, order, false);
        createTypedLines(document, ids(request.readerEmpIds()), ApprovalLine.TYPE_READER, order, false);
    }

    private int createTypedLines(ApprovalDocument document, List<Long> empIds, String lineType, int startOrder, boolean pending) {
        int order = startOrder;
        for (int index = 0; index < empIds.size(); index++) {
            Emp assignee = empRepository.findById(empIds.get(index))
                .orElseThrow(() -> BusinessException.notFound("APPROVAL_ASSIGNEE_NOT_FOUND", "Approval assignee was not found"));
            ApprovalLine line = ApprovalLine.builder()
                .document(document)
                .approver(assignee)
                .lineType(lineType)
                .lineOrder(order++)
                .first(false)
                .build();
            if (pending && (ApprovalLine.TYPE_AGREEMENT.equals(lineType) || index == 0)) {
                line.open();
            }
            lineRepository.save(line);
        }
        return order;
    }

    private void notifyInitialPendingLines(ApprovalDocument document, List<ApprovalLine> lines, Emp requester) {
        lines.stream()
            .filter(line -> ApprovalLine.STATUS_PENDING.equals(line.getStatus()))
            .forEach(line -> notificationService.notifyEmp(
                line.getAssignedEmp().getEmpId(),
                line.isAgreement() ? "전자결재 합의 요청" : "전자결재 요청",
                line.isAgreement() ? "합의 요청 문서가 도착했습니다." : "결재 요청 문서가 도착했습니다.",
                "APPROVAL",
                document.getApprovalId()
            ));
    }

    private void notifyPreviousApprovers(ApprovalDocument document, List<ApprovalLine> lines, ApprovalLine currentLine, String title, String message) {
        lines.stream()
            .filter(ApprovalLine::isApproval)
            .filter(line -> line.getLineOrder() < currentLine.getLineOrder())
            .map(ApprovalLine::getAssignedEmp)
            .map(Emp::getEmpId)
            .distinct()
            .forEach(empId -> notificationService.notifyEmp(empId, title, message, "APPROVAL", document.getApprovalId()));
    }

    private boolean hasAgreement(ApprovalRequest request) {
        return !ids(request.agreementEmpIds()).isEmpty();
    }

    private List<Long> ids(Collection<Long> empIds) {
        return empIds == null ? List.of() : empIds.stream().toList();
    }

    private synchronized String generateDocumentNo(String templateCode) {
        String prefix = switch (templateCode) {
            case "PURCHASE" -> "PUR";
            case "TRAINING_REQUEST", "TRAINING_REPORT" -> "EDU";
            default -> "APP";
        };
        String prefixYear = prefix + "-" + Year.now().getValue() + "-";
        jdbcTemplate.query("select pg_advisory_xact_lock(hashtext(?))", ps -> ps.setString(1, prefixYear), rs -> null);
        return prefixYear + String.format("%06d", documentRepository.findMaxDocumentSequence(prefixYear) + 1);
    }

    private String templateSnapshot(ApprovalTemplate template) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                "templateCode", template.getTemplateCode(),
                "templateName", template.getTemplateName(),
                "version", template.getVersion(),
                "description", template.getDescription() == null ? "" : template.getDescription(),
                "fieldsJson", template.getFieldsJson(),
                "printLayoutJson", template.getPrintLayoutJson() == null ? "" : template.getPrintLayoutJson()
            ));
        } catch (JsonProcessingException ex) {
            throw BusinessException.badRequest("TEMPLATE_SNAPSHOT_FAILED", "Failed to snapshot approval template");
        }
    }

    private String buildSearchText(String documentNo, String title, Emp requester, ApprovalTemplate template, String formDataJson) {
        return String.join(" ", safe(documentNo), safe(title), safe(requester.getEmpName()), safe(template.getTemplateName()), summarizeFormData(formDataJson)).trim();
    }

    private String summarizeFormData(String formDataJson) {
        if (!hasText(formDataJson)) {
            return "";
        }
        try {
            Object parsed = objectMapper.readValue(formDataJson, Object.class);
            if (parsed instanceof Map<?, ?> map && map.containsKey("content")) {
                Object content = map.get("content");
                return content == null ? "" : String.valueOf(content);
            }
            return String.valueOf(parsed);
        } catch (JsonProcessingException ex) {
            return formDataJson;
        }
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

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
