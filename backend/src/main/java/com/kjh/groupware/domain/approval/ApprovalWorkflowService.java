package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.ApprovalActionRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalResponse;
import com.kjh.groupware.domain.approval.dto.PurchaseRequestUpdateRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.emp.EmpSignatureService;
import com.kjh.groupware.domain.equipment.EquipmentManagementService;
import com.kjh.groupware.domain.file.AttachFile;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalWorkflowService {

    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLineRepository lineRepository;
    private final ApprovalTemplateRepository templateRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;
    private final NotificationService notificationService;
    private final EmpRepository empRepository;
    private final EmpSignatureService signatureService;
    private final ApprovalPdfService pdfService;
    private final ApprovalPermissionService permissionService;
    private final ApprovalReminderService reminderService;
    private final ApprovalLinePolicyService linePolicyService;
    private final ApprovalEquipmentProposalService equipmentProposalService;
    private final ApprovalLeaveUsageService leaveUsageService;
    private final EquipmentManagementService equipmentManagementService;
    private final ObjectMapper objectMapper;

    @Transactional
    public ApprovalResponse act(Long approvalId, String action, ApprovalActionRequest request, String ipAddress, String userAgent) {
        ApprovalActionCode actionCode = ApprovalActionCode.from(action);
        if (actionCode == ApprovalActionCode.APPROVE) {
            return approve(approvalId, request, ipAddress, userAgent);
        }
        if (actionCode == ApprovalActionCode.REJECT) {
            return reject(approvalId, request, ipAddress, userAgent);
        }
        if (actionCode == ApprovalActionCode.WITHDRAW) {
            return withdraw(approvalId, request, ipAddress, userAgent);
        }
        if (actionCode == ApprovalActionCode.CANCEL) {
            return cancel(approvalId, ipAddress, userAgent);
        }
        if (actionCode == ApprovalActionCode.REDRAFT) {
            return redraft(approvalId, ipAddress, userAgent);
        }
        if (actionCode == ApprovalActionCode.RECEIVE) {
            return receive(approvalId, ipAddress, userAgent);
        }
        if (actionCode == ApprovalActionCode.COMPLETE_RECEIPT) {
            return completeReceipt(approvalId, request, ipAddress, userAgent);
        }
        if (actionCode == ApprovalActionCode.STATUS_CORRECTION) {
            return correctStatus(approvalId, request, ipAddress, userAgent);
        }
        return regeneratePdf(approvalId, request);
    }

    @Transactional
    public ApprovalResponse approve(Long approvalId, ApprovalActionRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getPendingDocumentForUpdate(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        ApprovalLine currentLine = linePolicyService.currentDecisionLineForUpdate(lines, currentEmp);
        equipmentProposalService.assertApprovalActionAllowed(document);

        AttachFile signatureFile = currentLine.isApproval() ? signatureService.activeSignatureFile(currentEmp) : null;
        currentLine.approve(currentEmp, request == null ? null : request.comment(), signatureFile, signatureService.snapshotJson(currentEmp));

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
        ApprovalLine currentLine = linePolicyService.currentDecisionLineForUpdate(lines, currentEmp);

        currentLine.reject(currentEmp, comment);
        lines.stream()
            .filter(line -> !line.getLineId().equals(currentLine.getLineId()))
            .filter(line -> !line.isActed())
            .filter(line -> !ApprovalLine.STATUS_SKIPPED.equals(line.getStatus()))
            .forEach(line -> line.skip("REJECTED"));
        document.reject();
        equipmentManagementService.onApprovalResolved(document, false);
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
        List<ApprovalLine> copiedLines = copyLinesForRedraft(source, copy);
        auditApproval(requester, AuditActionType.REDRAFT, copy, "반려 문서 재상신 초안 생성", true, ipAddress, userAgent);
        return response(copy, copiedLines, requester);
    }

    private List<ApprovalLine> copyLinesForRedraft(ApprovalDocument source, ApprovalDocument copy) {
        return lineRepository.findByDocumentOrderByLineOrderAsc(source).stream()
            .map(sourceLine -> {
                Emp assignee = sourceLine.getAssignedEmp() == null ? sourceLine.getApprover() : sourceLine.getAssignedEmp();
                ApprovalLine copiedLine = ApprovalLine.builder()
                    .document(copy)
                    .approver(assignee)
                    .lineType(sourceLine.getLineType())
                    .lineOrder(sourceLine.getLineOrder())
                    .first(false)
                    .build();
                return lineRepository.save(copiedLine);
            })
            .toList();
    }

    @Transactional
    public ApprovalResponse receive(Long approvalId, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getPurchaseReceivableDocumentForUpdate(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        ApprovalLine receiverLine = linePolicyService.receiverLineForUpdate(lines, currentEmp);
        if (ApprovalLine.STATUS_WAITING.equals(receiverLine.getStatus()) && isReceiverRoutedReadyForReceiver(document, lines)) {
            receiverLine.markReceived();
        }
        if (!ApprovalLine.STATUS_RECEIVED.equals(receiverLine.getStatus())) {
            throw BusinessException.badRequest("APPROVAL_RECEIVE_DUPLICATED", "이미 처리된 문서입니다.");
        }
        receiverLine.markRead();
        if (isReceiverRoutedDocument(document) && document.isPending()) {
            document.moveToReceiverProgress();
        }
        auditApproval(currentEmp, AuditActionType.RECEIVE, document, "수신 확인", true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), currentEmp);
    }

    @Transactional
    public ApprovalResponse completeReceipt(Long approvalId, ApprovalActionRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getApprovedDocumentForUpdate(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        ApprovalLine receiverLine = linePolicyService.receiverLineForUpdate(lines, currentEmp);
        if (!ApprovalLine.STATUS_RECEIVED.equals(receiverLine.getStatus()) && !ApprovalLine.STATUS_READ.equals(receiverLine.getStatus())) {
            throw BusinessException.badRequest("APPROVAL_RECEIPT_DUPLICATED", "이미 처리된 문서입니다.");
        }
        receiverLine.completeReceipt(currentEmp, request == null ? null : request.comment());
        auditApproval(currentEmp, AuditActionType.COMPLETE_RECEIPT, document, request == null ? null : request.comment(), true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), currentEmp);
    }

    @Transactional
    public ApprovalResponse updatePurchaseRequest(Long approvalId, PurchaseRequestUpdateRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getPurchaseReceivableDocumentForUpdate(approvalId);
        if (!isReceiverRoutedDocument(document)) {
            throw BusinessException.badRequest("APPROVAL_PURCHASE_ONLY", "Only purchase request documents can be updated here");
        }
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        linePolicyService.receiverLineForUpdate(lines, currentEmp);
        ApprovalTemplate template = activeTemplate(document.getTemplateCode());
        String formDataJson = updateFormField(document.getFormDataJson(), "deliveryDate", request == null ? null : request.deliveryDate());
        document.updateFormDataJson(formDataJson, buildSearchText(document.getDocumentNo(), document.getTitle(), document.getRequester(), template, formDataJson));
        if (ApprovalDocument.PDF_STATUS_GENERATED.equals(document.getPdfStatus()) && document.getPdfFile() != null) {
            pdfService.generateForFinalApproval(document);
        }
        auditApproval(currentEmp, AuditActionType.UPDATE, document, "purchase delivery date updated", true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), currentEmp);
    }

    @Transactional
    public ApprovalResponse submitPurchaseApproval(Long approvalId, PurchaseRequestUpdateRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = getActiveDocumentForUpdate(approvalId);
        if (!isReceiverRoutedDocument(document)) {
            throw BusinessException.badRequest("APPROVAL_PURCHASE_ONLY", "Only purchase request documents can be processed here");
        }
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        ApprovalLine receiverLine = linePolicyService.receiverLineForUpdate(lines, currentEmp);
        if (!document.isPending()) {
            throw BusinessException.badRequest("APPROVAL_PURCHASE_STAGE_INVALID", "Purchase approval can be submitted only after receiver handoff");
        }
        if (!ApprovalLine.STATUS_RECEIVED.equals(receiverLine.getStatus()) && !ApprovalLine.STATUS_READ.equals(receiverLine.getStatus())) {
            throw BusinessException.badRequest("APPROVAL_PURCHASE_RECEIVE_REQUIRED", "Purchase receiver must receive the document first");
        }
        List<Long> agreementIds = ids(request == null ? null : request.agreementEmpIds());
        List<Long> approverIds = ids(request == null ? null : request.approverEmpIds());
        if (approverIds.isEmpty()) {
            throw BusinessException.badRequest("APPROVAL_PURCHASE_APPROVER_REQUIRED", "Purchase approval line is required");
        }
        validatePurchaseDecisionLine(currentEmp, agreementIds, approverIds);
        if (ApprovalLine.STATUS_RECEIVED.equals(receiverLine.getStatus())) {
            receiverLine.markRead();
        }
        int order = nextLineOrder(lines);
        for (Long empId : agreementIds) {
            createPurchaseDecisionLine(document, activeEmp(empId), ApprovalLine.TYPE_AGREEMENT, order++, true);
        }
        boolean firstApproval = agreementIds.isEmpty();
        for (Long empId : approverIds) {
            createPurchaseDecisionLine(document, activeEmp(empId), ApprovalLine.TYPE_APPROVAL, order++, firstApproval);
            firstApproval = false;
        }
        document.moveToApprovalProgress();
        Emp firstAssignee = activeEmp(agreementIds.isEmpty() ? approverIds.get(0) : agreementIds.get(0));
        notificationService.notifyEmp(firstAssignee.getEmpId(), "구매요구서 구매팀 결재", "구매팀 결재 요청 문서가 도착했습니다.", "APPROVAL", approvalId);
        auditApproval(currentEmp, AuditActionType.UPDATE, document, "purchase approval submitted", true, ipAddress, userAgent);
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), currentEmp);
    }

    @Transactional
    public ApprovalResponse regeneratePdf(Long approvalId, ApprovalActionRequest request) {
        ApprovalDocument document = pdfService.regenerate(approvalId, request == null ? null : request.comment());
        return response(document, lineRepository.findByDocumentOrderByLineOrderAsc(document), currentEmpProvider.getCurrentEmp());
    }

    @Transactional
    public ApprovalResponse correctStatus(Long approvalId, ApprovalActionRequest request, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        if (!permissionService.canManageOperations(currentEmp)) {
            throw BusinessException.forbidden("APPROVAL_CORRECTION_FORBIDDEN", "전자결재 관리자만 상태를 보정할 수 있습니다.");
        }
        ApprovalDocument document = getActiveDocumentForUpdate(approvalId);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(document);
        String correctedStage = correctedStage(document, lines);
        document.correctCurrentStage(correctedStage, request == null ? "상태 보정" : request.comment());
        auditApproval(currentEmp, AuditActionType.CORRECT_APPROVAL_STATUS, document, "단계 보정: " + correctedStage, true, ipAddress, userAgent);
        return response(document, lines, currentEmp);
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
        firstApprover.open(reminderService.decisionDueAt());
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
            nextApprover.open(reminderService.decisionDueAt());
            notificationService.notifyEmp(nextApprover.getAssignedEmp().getEmpId(), "전자결재 요청", "결재 요청 문서가 도착했습니다.", "APPROVAL", document.getApprovalId());
            return;
        }
        if (equipmentProposalService.progressAfterApproval(document, lines, currentLine)) {
            return;
        }
        if (progressReceiverRoutedDocumentAfterApproval(document, lines)) {
            return;
        }
        leaveUsageService.assertNoCompletedLeaveOverlap(document);
        leaveUsageService.assertLeaveCancelTargetsApproved(document);
        document.approve();
        equipmentManagementService.onApprovalResolved(document, true);
        pdfService.generateForFinalApproval(document);
        openPostApprovalLines(document, lines);
        notificationService.notifyEmp(document.getRequester().getEmpId(), "전자결재 완료", "상신한 문서가 최종 승인되었습니다.", "APPROVAL", document.getApprovalId());
    }

    private boolean progressReceiverRoutedDocumentAfterApproval(ApprovalDocument document, List<ApprovalLine> lines) {
        if (!isReceiverRoutedDocument(document)) {
            return false;
        }
        boolean alreadyReceived = lines.stream()
            .filter(ApprovalLine::isReceiver)
            .anyMatch(line -> ApprovalLine.STATUS_RECEIVED.equals(line.getStatus())
                || ApprovalLine.STATUS_READ.equals(line.getStatus())
                || ApprovalLine.STATUS_RECEIPT_COMPLETED.equals(line.getStatus()));
        if (alreadyReceived) {
            return false;
        }
        List<ApprovalLine> receiverLines = lines.stream()
            .filter(ApprovalLine::isReceiver)
            .filter(line -> ApprovalLine.STATUS_WAITING.equals(line.getStatus()))
            .toList();
        if (receiverLines.isEmpty()) {
            return false;
        }
        receiverLines.forEach(line -> {
            line.markReceived();
            notificationService.notifyEmp(line.getAssignedEmp().getEmpId(), "구매요구서 수신", "작성부서 결재가 완료되어 구매팀 수신 단계로 전달되었습니다.", "APPROVAL", document.getApprovalId());
        });
        document.moveToReceiverProgress();
        notificationService.notifyEmp(document.getRequester().getEmpId(), "구매요구서 구매팀 전달", "구매요구서가 구매팀 수신 단계로 전달되었습니다.", "APPROVAL", document.getApprovalId());
        return true;
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

    private void validatePurchaseDecisionLine(Emp currentEmp, List<Long> agreementIds, List<Long> approverIds) {
        requireNoDuplicate("PURCHASE_AGREEMENT_DUPLICATED", agreementIds);
        requireNoDuplicate("PURCHASE_APPROVER_DUPLICATED", approverIds);
        Set<Long> combined = new HashSet<>(agreementIds);
        for (Long approverId : approverIds) {
            if (!combined.add(approverId)) {
                throw BusinessException.badRequest("APPROVAL_PURCHASE_LINE_DUPLICATED", "Purchase agreement and approval assignees cannot overlap");
            }
        }
        if (agreementIds.contains(currentEmp.getEmpId()) || approverIds.contains(currentEmp.getEmpId())) {
            throw BusinessException.badRequest("APPROVAL_PURCHASE_LINE_INVALID", "Purchase receiver cannot approve their own submitted purchase approval line");
        }
        agreementIds.forEach(this::activeEmp);
        approverIds.forEach(this::activeEmp);
    }

    private void requireNoDuplicate(String code, List<Long> empIds) {
        if (new HashSet<>(empIds).size() != empIds.size()) {
            throw BusinessException.badRequest(code, "Approval assignees cannot contain duplicates");
        }
    }

    private ApprovalLine createPurchaseDecisionLine(ApprovalDocument document, Emp assignee, String lineType, int order, boolean first) {
        ApprovalLine line = ApprovalLine.builder()
            .document(document)
            .approver(assignee)
            .lineType(lineType)
            .lineOrder(order)
            .first(false)
            .build();
        if (first) {
            line.open(reminderService.decisionDueAt());
        }
        return lineRepository.save(line);
    }

    private int nextLineOrder(List<ApprovalLine> lines) {
        return lines.stream()
            .map(ApprovalLine::getLineOrder)
            .filter(order -> order != null)
            .max(Integer::compareTo)
            .orElse(0) + 1;
    }

    private List<Long> ids(Collection<Long> empIds) {
        return empIds == null ? List.of() : empIds.stream().toList();
    }

    private Emp activeEmp(Long empId) {
        if (empId == null) {
            throw BusinessException.badRequest("APPROVAL_ASSIGNEE_REQUIRED", "Approval assignee is required");
        }
        Emp emp = empRepository.findById(empId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_ASSIGNEE_NOT_FOUND", "Approval assignee was not found"));
        if (!emp.isActiveUser()) {
            throw BusinessException.badRequest("APPROVAL_ASSIGNEE_INACTIVE", "재직 중인 사용자만 결재선에 지정할 수 있습니다: " + emp.getEmpName());
        }
        return emp;
    }

    private String correctedStage(ApprovalDocument document, List<ApprovalLine> lines) {
        return switch (document.getStatus()) {
            case ApprovalDocument.STATUS_DRAFT -> ApprovalDocument.STAGE_DRAFT;
            case ApprovalDocument.STATUS_APPROVED -> ApprovalDocument.STAGE_COMPLETED;
            case ApprovalDocument.STATUS_REJECTED -> ApprovalDocument.STAGE_REJECTED;
            case ApprovalDocument.STATUS_WITHDRAWN -> ApprovalDocument.STAGE_WITHDRAWN;
            case ApprovalDocument.STATUS_CANCELED -> ApprovalDocument.STAGE_CANCELED;
            case ApprovalDocument.STATUS_IN_PROGRESS -> correctedInProgressStage(lines);
            default -> document.getCurrentStage();
        };
    }

    private String correctedInProgressStage(List<ApprovalLine> lines) {
        boolean hasUnfinishedAgreement = lines.stream()
            .filter(ApprovalLine::isAgreement)
            .anyMatch(line -> !ApprovalLine.STATUS_APPROVED.equals(line.getStatus())
                && !ApprovalLine.STATUS_SKIPPED.equals(line.getStatus()));
        if (hasUnfinishedAgreement) {
            return ApprovalDocument.STAGE_AGREEMENT_PROGRESS;
        }
        boolean hasOpenReceiver = lines.stream()
            .filter(ApprovalLine::isReceiver)
            .anyMatch(line -> ApprovalLine.STATUS_RECEIVED.equals(line.getStatus()) || ApprovalLine.STATUS_READ.equals(line.getStatus()));
        if (hasOpenReceiver) {
            return ApprovalDocument.STAGE_RECEIVER_PROGRESS;
        }
        return ApprovalDocument.STAGE_APPROVAL_PROGRESS;
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

    private ApprovalTemplate activeTemplate(String templateCode) {
        return templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(templateCode, "Y")
            .orElseGet(() -> {
                if (ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE.equals(templateCode)) {
                    return ApprovalTemplate.builder()
                        .templateCode(ApprovalLeaveUsageService.LEAVE_CANCEL_TEMPLATE_CODE)
                        .templateName("휴가 취소계")
                        .version(1)
                        .description("승인 완료된 휴가 취소 신청")
                        .fieldsJson("[]")
                        .activeYn("Y")
                        .sortOrder(0)
                        .build();
                }
                throw BusinessException.badRequest("APPROVAL_TEMPLATE_NOT_FOUND", "Active approval template was not found");
            });
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

    private ApprovalDocument getPurchaseReceivableDocumentForUpdate(Long approvalId) {
        ApprovalDocument document = getActiveDocumentForUpdate(approvalId);
        if (ApprovalDocument.STATUS_APPROVED.equals(document.getStatus())) {
            return document;
        }
        if (isReceiverRoutedDocument(document) && document.isPending()) {
            return document;
        }
        throw BusinessException.badRequest("APPROVAL_NOT_RECEIVABLE", "Only approved or purchase receiver-progress documents can be received");
    }

    private void assertRequester(Emp currentEmp, ApprovalDocument document) {
        if (!document.getRequester().getEmpId().equals(currentEmp.getEmpId())) {
            throw BusinessException.forbidden("APPROVAL_FORBIDDEN", "Only the requester can change this approval document");
        }
    }

    private ApprovalResponse response(ApprovalDocument document, List<ApprovalLine> lines, Emp currentEmp) {
        return ApprovalResponse.from(document, lines, permissionService.permissions(currentEmp, document, lines));
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

    private String updateFormField(String formDataJson, String fieldName, String value) {
        try {
            Map<String, Object> root = formDataJson == null || formDataJson.isBlank()
                ? new LinkedHashMap<>()
                : objectMapper.readValue(formDataJson, new com.fasterxml.jackson.core.type.TypeReference<LinkedHashMap<String, Object>>() {});
            Object fieldsObject = root.get("fields");
            Map<String, Object> fields = new LinkedHashMap<>();
            if (fieldsObject instanceof Map<?, ?> map) {
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    fields.put(String.valueOf(entry.getKey()), entry.getValue());
                }
            }
            fields.put(fieldName, value == null ? "" : value);
            root.put("fields", fields);
            return objectMapper.writeValueAsString(root);
        } catch (JsonProcessingException ex) {
            throw BusinessException.badRequest("APPROVAL_FORM_INVALID_JSON", "Approval form data JSON is invalid");
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

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
