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
public class ApprovalService {

    private static final String BOX_REQUESTED = "requested";
    private static final String BOX_PENDING = "pending";
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

        if (BOX_PENDING.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findByApproverAndStatusOrderByLineIdDesc(currentEmp, ApprovalLine.STATUS_PENDING, linePageRequest)
                .map(line -> summary(line.getDocument())));
        }
        if (BOX_PROCESSED.equals(normalizedBox)) {
            return PageResponse.from(lineRepository.findByApproverAndStatusInOrderByLineIdDesc(
                    currentEmp,
                    List.of(ApprovalLine.STATUS_APPROVED, ApprovalLine.STATUS_REJECTED),
                    linePageRequest
                )
                .map(line -> summary(line.getDocument())));
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
        List<Long> approverIds = approverIds(request);

        String documentNo = generateDocumentNo(template.getTemplateCode());
        String title = hasText(request.title()) ? request.title() : template.getTemplateName();
        String content = request.content() == null ? summarizeFormData(request.formDataJson()) : request.content();
        ApprovalDocument document = documentRepository.save(ApprovalDocument.builder()
            .documentNo(documentNo)
            .title(title)
            .content(content)
            .templateCode(template.getTemplateCode())
            .templateVersion(template.getVersion())
            .templateSnapshotJson(templateSnapshot(template))
            .formDataJson(request.formDataJson())
            .searchText(buildSearchText(documentNo, title, requester, template, request.formDataJson()))
            .requester(requester)
            .build());

        if (draft) {
            document.saveAsDraft();
            createDraftLines(document, approverIds);
        } else {
            validateApprovers(requester, approverIds);
            createLines(document, requester, approverIds);
        }

        auditLogService.record(requester.getEmpId(), AuditActionType.CREATE, "approval_document", document.getApprovalId(), ipAddress, userAgent);
        return ApprovalResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
    }

    @Transactional
    public ApprovalResponse createDraft(ApprovalRequest request, String ipAddress, String userAgent) {
        ApprovalRequest draftRequest = new ApprovalRequest(
            request.title(),
            request.content(),
            request.templateCode(),
            request.formDataJson(),
            request.approverEmpIds(),
            true
        );
        return create(draftRequest, ipAddress, userAgent);
    }

    @Transactional
    public ApprovalResponse updateDraft(Long approvalId, ApprovalRequest request, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getActiveDocument(approvalId);
        assertRequester(requester, document);
        if (!document.isDraft()) {
            throw BusinessException.badRequest("APPROVAL_NOT_DRAFT", "Only draft approval documents can be updated");
        }

        ApprovalTemplate template = activeTemplate(request.templateCode());
        String title = hasText(request.title()) ? request.title() : template.getTemplateName();
        String content = request.content() == null ? summarizeFormData(request.formDataJson()) : request.content();
        List<Long> approverIds = approverIds(request);
        document.updateDraft(
            title,
            content,
            template.getTemplateCode(),
            template.getVersion(),
            templateSnapshot(template),
            request.formDataJson(),
            buildSearchText(document.getDocumentNo(), title, requester, template, request.formDataJson())
        );
        lineRepository.deleteByDocument(document);
        createDraftLines(document, approverIds);
        auditLogService.record(requester.getEmpId(), AuditActionType.UPDATE, "approval_document", document.getApprovalId(), ipAddress, userAgent);
        return ApprovalResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
    }

    @Transactional
    public ApprovalResponse submit(Long approvalId, ApprovalRequest request, String ipAddress, String userAgent) {
        ApprovalResponse updated = updateDraft(approvalId, request, ipAddress, userAgent);
        ApprovalDocument document = getActiveDocument(updated.approvalId());
        Emp requester = currentEmpProvider.getCurrentEmp();
        List<Long> approverIds = approverIds(request);
        validateApprovers(requester, approverIds);
        lineRepository.deleteByDocument(document);
        createLines(document, requester, approverIds);
        document.submit(document.getSearchText());
        auditLogService.record(requester.getEmpId(), AuditActionType.UPDATE, "approval_document", document.getApprovalId(), ipAddress, userAgent);
        return ApprovalResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
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

        AttachFile signatureFile = signatureService.activeSignatureFile(currentEmp);
        currentLine.approve(request == null ? null : request.comment(), signatureFile, signatureService.snapshotJson(currentEmp));
        ApprovalLine nextLine = lines.stream()
            .filter(line -> line.getLineOrder() > currentLine.getLineOrder())
            .filter(line -> ApprovalLine.STATUS_WAITING.equals(line.getStatus()))
            .findFirst()
            .orElse(null);
        if (nextLine == null) {
            document.approve();
            pdfService.generateForFinalApproval(document);
            notificationService.notifyEmp(document.getRequester().getEmpId(), "Approval completed", document.getTitle() + " was approved.", "APPROVAL", document.getApprovalId());
        } else {
            nextLine.open();
            notificationService.notifyEmp(nextLine.getApprover().getEmpId(), "Approval requested", document.getTitle() + " needs your approval.", "APPROVAL", document.getApprovalId());
        }
        notifyPreviousApprovers(document, lines, currentLine, "Approval progressed", currentEmp.getEmpName() + " approved " + document.getTitle() + ".");

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
        notificationService.notifyEmp(document.getRequester().getEmpId(), "Approval rejected", document.getTitle() + " was rejected.", "APPROVAL", document.getApprovalId());
        notifyPreviousApprovers(document, lines, currentLine, "Approval rejected", currentEmp.getEmpName() + " rejected " + document.getTitle() + ".");
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.UPDATE, "approval_document", document.getApprovalId(), ipAddress, userAgent);
        return ApprovalResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
    }

    @Transactional
    public ApprovalResponse withdraw(Long approvalId, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getPendingDocument(approvalId);
        assertRequester(requester, document);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        if (lines.stream().anyMatch(ApprovalLine::isActed)) {
            throw BusinessException.badRequest("APPROVAL_ALREADY_ACTED", "Approval documents can be withdrawn only before any approver acts");
        }
        lines.forEach(line -> line.skip("WITHDRAWN"));
        document.withdraw();
        auditLogService.record(requester.getEmpId(), AuditActionType.UPDATE, "approval_document", document.getApprovalId(), ipAddress, userAgent);
        return ApprovalResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
    }

    @Transactional
    public ApprovalResponse redraft(Long approvalId, String ipAddress, String userAgent) {
        Emp requester = currentEmpProvider.getCurrentEmp();
        ApprovalDocument source = getActiveDocument(approvalId);
        assertRequester(requester, source);
        if (!ApprovalDocument.STATUS_WITHDRAWN.equals(source.getStatus()) && !ApprovalDocument.STATUS_REJECTED.equals(source.getStatus())) {
            throw BusinessException.badRequest("APPROVAL_CANNOT_REDRAFT", "Only withdrawn or rejected approval documents can be redrafted");
        }
        ApprovalTemplate template = activeTemplate(source.getTemplateCode());
        String documentNo = generateDocumentNo(template.getTemplateCode());
        ApprovalDocument copy = documentRepository.save(ApprovalDocument.builder()
            .documentNo(documentNo)
            .title(source.getTitle())
            .content(source.getContent())
            .templateCode(template.getTemplateCode())
            .templateVersion(template.getVersion())
            .templateSnapshotJson(templateSnapshot(template))
            .formDataJson(source.getFormDataJson())
            .searchText(buildSearchText(documentNo, source.getTitle(), requester, template, source.getFormDataJson()))
            .requester(requester)
            .build());
        copy.saveAsDraft();
        auditLogService.record(requester.getEmpId(), AuditActionType.CREATE, "approval_document", copy.getApprovalId(), ipAddress, userAgent);
        return ApprovalResponse.from(copy, List.of());
    }

    @Transactional
    public ApprovalResponse regeneratePdf(Long approvalId, ApprovalActionRequest request) {
        ApprovalDocument document = pdfService.regenerate(approvalId, request == null ? null : request.comment());
        return ApprovalResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
    }

    private ApprovalSummaryResponse summary(ApprovalDocument document) {
        return ApprovalSummaryResponse.from(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
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

    private void assertRequester(Emp currentEmp, ApprovalDocument document) {
        if (!document.getRequester().getEmpId().equals(currentEmp.getEmpId())) {
            throw BusinessException.forbidden("APPROVAL_FORBIDDEN", "Only the requester can change this approval document");
        }
    }

    private List<Long> approverIds(ApprovalRequest request) {
        return request.approverEmpIds() == null ? List.of() : request.approverEmpIds().stream().distinct().toList();
    }

    private void validateApprovers(Emp requester, List<Long> approverIds) {
        if (approverIds.isEmpty()) {
            throw BusinessException.badRequest("APPROVAL_INVALID_LINE", "At least one approver is required");
        }
        if (approverIds.contains(requester.getEmpId())) {
            throw BusinessException.badRequest("APPROVAL_INVALID_LINE", "Requester cannot approve their own document");
        }
    }

    private void createLines(ApprovalDocument document, Emp requester, List<Long> approverIds) {
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
                notificationService.notifyEmp(approver.getEmpId(), "Approval requested", requester.getEmpName() + " requested approval.", "APPROVAL", document.getApprovalId());
            }
        }
    }

    private void createDraftLines(ApprovalDocument document, List<Long> approverIds) {
        for (int index = 0; index < approverIds.size(); index++) {
            Emp approver = empRepository.findById(approverIds.get(index))
                .orElseThrow(() -> BusinessException.notFound("APPROVER_NOT_FOUND", "Approver was not found"));
            lineRepository.save(ApprovalLine.builder()
                .document(document)
                .approver(approver)
                .lineOrder(index + 1)
                .first(false)
                .build());
        }
    }

    private void notifyPreviousApprovers(ApprovalDocument document, List<ApprovalLine> lines, ApprovalLine currentLine, String title, String message) {
        lines.stream()
            .filter(line -> line.getLineOrder() < currentLine.getLineOrder())
            .map(ApprovalLine::getApprover)
            .map(Emp::getEmpId)
            .distinct()
            .forEach(empId -> notificationService.notifyEmp(empId, title, message, "APPROVAL", document.getApprovalId()));
    }

    private synchronized String generateDocumentNo(String templateCode) {
        String prefix = switch (templateCode) {
            case "PURCHASE" -> "PUR";
            case "TRAINING_REQUEST", "TRAINING_REPORT" -> "EDU";
            default -> "APP";
        };
        String prefixYear = prefix + "-" + Year.now().getValue() + "-";
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
