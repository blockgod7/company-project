package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.approval.dto.EquipmentProposalRequest;
import com.kjh.groupware.domain.approval.dto.EquipmentProposalResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalEquipmentProposalService {

    private final ApprovalEquipmentProposalRepository proposalRepository;
    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLineRepository lineRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final ApprovalReminderService reminderService;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    @Transactional
    public void syncFromApprovalRequest(ApprovalDocument document, ApprovalRequest request) {
        if (!ApprovalEquipmentProposal.TEMPLATE_CODE.equals(document.getTemplateCode())) {
            return;
        }
        ApprovalEquipmentProposal proposal = proposalRepository.findByApprovalApprovalId(document.getApprovalId())
            .orElseGet(() -> new ApprovalEquipmentProposal(document));
        JsonNode fields = formFields(request.formDataJson());
        proposal.updateUserSection(
            text(fields, "requestDeptName", requesterDeptName(document)),
            text(fields, "equipmentName", ""),
            text(fields, "requiredCompletionDate", ""),
            text(fields, "equipmentCapacity", ""),
            text(fields, "requestType", ""),
            text(fields, "currentState", ""),
            text(fields, "requirements", ""),
            text(fields, "instructions", ""),
            text(fields, "userEconomicReview", "")
        );
        proposalRepository.save(proposal);
    }

    @Transactional(readOnly = true)
    public EquipmentProposalResponse find(Long approvalId) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalEquipmentProposal proposal = getProposal(approvalId);
        return response(proposal, currentEmp);
    }

    @Transactional
    public EquipmentProposalResponse update(Long approvalId, EquipmentProposalRequest request) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalEquipmentProposal proposal = getProposalForUpdate(approvalId);
        if (canEditUserSection(currentEmp, proposal)) {
            proposal.updateUserSection(
                blankToDefault(request.requestDeptName(), proposal.getRequestDeptName()),
                request.equipmentName(),
                request.requiredCompletionDate(),
                request.equipmentCapacity(),
                request.requestType(),
                request.currentState(),
                request.requirements(),
                request.instructions(),
                request.userEconomicReview()
            );
        }
        if (canEditPeSection(currentEmp, proposal)) {
            proposal.updatePeSection(request.peOpinion(), request.designOpinion(), request.peEconomicReview());
        }
        if (canEditPurchaseSection(currentEmp, proposal)) {
            proposal.updatePurchaseSection(
                request.purchaseOpinion(),
                request.vendorName(),
                request.deliveryDueDate(),
                request.purchaseItemName(),
                request.purchaseUsage(),
                request.quantity(),
                request.price(),
                request.purchaseNote(),
                Boolean.TRUE.equals(request.attachmentContract()),
                Boolean.TRUE.equals(request.attachmentQuote()),
                Boolean.TRUE.equals(request.attachmentDrawing()),
                Boolean.TRUE.equals(request.attachmentSpec()),
                request.attachmentEtc()
            );
        }
        if (!canEditUserSection(currentEmp, proposal) && !canEditPeSection(currentEmp, proposal) && !canEditPurchaseSection(currentEmp, proposal)) {
            throw BusinessException.forbidden("EQUIPMENT_PROPOSAL_FORBIDDEN", "No editable equipment proposal section is available");
        }
        return response(proposal, currentEmp);
    }

    @Transactional
    public EquipmentProposalResponse assignPe(Long approvalId, EquipmentProposalRequest request) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalEquipmentProposal proposal = getProposalForUpdate(approvalId);
        if (!canAssignPe(currentEmp, proposal)) {
            throw BusinessException.forbidden("EQUIPMENT_PE_ASSIGN_FORBIDDEN", "Only the production engineering manager can assign this proposal");
        }
        Emp assignee = activeEmp(request.peAssigneeEmpId());
        requireDept(assignee, "PROD_TECH", "Production engineering assignee must belong to PROD_TECH");
        proposal.assignPe(assignee);
        pendingLine(proposal.getApproval(), ApprovalEquipmentProposal.STAGE_PE_INPUT).reassign(assignee);
        notificationService.notifyEmp(assignee.getEmpId(), "설비 품의서 주관부서 작성", "설비 품의서 담당자로 지정되었습니다.", "APPROVAL", approvalId);
        return response(proposal, currentEmp);
    }

    @Transactional
    public EquipmentProposalResponse submitPe(Long approvalId, EquipmentProposalRequest request) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalEquipmentProposal proposal = getProposalForUpdate(approvalId);
        if (!canEditPeSection(currentEmp, proposal)) {
            throw BusinessException.forbidden("EQUIPMENT_PE_FORBIDDEN", "Only the production engineering assignee can submit this section");
        }
        proposal.updatePeSection(request.peOpinion(), request.designOpinion(), request.peEconomicReview());
        ApprovalLine inputLine = pendingLine(proposal.getApproval(), ApprovalEquipmentProposal.STAGE_PE_INPUT);
        inputLine.skip("PE_INPUT_COMPLETED");
        List<Long> approverIds = ids(request.approverEmpIds());
        if (approverIds.isEmpty()) {
            throw BusinessException.badRequest("EQUIPMENT_PE_APPROVER_REQUIRED", "Production engineering approval line is required");
        }
        requireNoDuplicate("EQUIPMENT_PE_APPROVER_DUPLICATED", approverIds);
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(proposal.getApproval());
        int order = nextOrder(lines);
        boolean first = true;
        for (Long empId : approverIds) {
            Emp approver = activeEmp(empId);
            createTypedLine(proposal.getApproval(), approver, ApprovalLine.TYPE_APPROVAL, order++, first);
            first = false;
        }
        proposal.moveToPeApproval();
        notificationService.notifyEmp(currentEmp.getEmpId(), "설비 품의서 주관부서 결재", "주관부서 의견 작성이 완료되었습니다. 승인 처리를 진행해 주세요.", "APPROVAL", approvalId);
        return response(proposal, currentEmp);
    }

    @Transactional
    public EquipmentProposalResponse assignPurchase(Long approvalId, EquipmentProposalRequest request) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalEquipmentProposal proposal = getProposalForUpdate(approvalId);
        if (!canAssignPurchase(currentEmp, proposal)) {
            throw BusinessException.forbidden("EQUIPMENT_PURCHASE_ASSIGN_FORBIDDEN", "Only the purchase assignee can change this receiver");
        }
        Emp assignee = activeEmp(request.purchaseAssigneeEmpId());
        requireDept(assignee, "PURCHASE", "Purchase assignee must belong to PURCHASE");
        proposal.assignPurchase(assignee);
        pendingLine(proposal.getApproval(), ApprovalEquipmentProposal.STAGE_PURCHASE_INPUT).reassign(assignee);
        notificationService.notifyEmp(assignee.getEmpId(), "설비 품의서 구매 작성", "설비 품의서 구매 담당자로 지정되었습니다.", "APPROVAL", approvalId);
        return response(proposal, currentEmp);
    }

    @Transactional
    public EquipmentProposalResponse submitPurchase(Long approvalId, EquipmentProposalRequest request) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalEquipmentProposal proposal = getProposalForUpdate(approvalId);
        if (!canEditPurchaseSection(currentEmp, proposal)) {
            throw BusinessException.forbidden("EQUIPMENT_PURCHASE_FORBIDDEN", "Only the purchase assignee can submit this section");
        }
        proposal.updatePurchaseSection(
            request.purchaseOpinion(),
            request.vendorName(),
            request.deliveryDueDate(),
            request.purchaseItemName(),
            request.purchaseUsage(),
            request.quantity(),
            request.price(),
            request.purchaseNote(),
            Boolean.TRUE.equals(request.attachmentContract()),
            Boolean.TRUE.equals(request.attachmentQuote()),
            Boolean.TRUE.equals(request.attachmentDrawing()),
            Boolean.TRUE.equals(request.attachmentSpec()),
            request.attachmentEtc()
        );
        List<Long> agreementIds = ids(request.agreementEmpIds());
        List<Long> approverIds = ids(request.approverEmpIds());
        if (approverIds.isEmpty()) {
            throw BusinessException.badRequest("EQUIPMENT_PURCHASE_APPROVER_REQUIRED", "Purchase approval line is required");
        }
        requireNoDuplicate("EQUIPMENT_PURCHASE_AGREEMENT_DUPLICATED", agreementIds);
        requireNoDuplicate("EQUIPMENT_PURCHASE_APPROVER_DUPLICATED", approverIds);
        requireNoOverlap(agreementIds, approverIds);
        ApprovalLine inputLine = pendingLine(proposal.getApproval(), ApprovalEquipmentProposal.STAGE_PURCHASE_INPUT);
        inputLine.skip("PURCHASE_INPUT_COMPLETED");
        List<ApprovalLine> lines = lineRepository.findByDocumentOrderByLineOrderAsc(proposal.getApproval());
        int order = nextOrder(lines);
        for (Long empId : agreementIds) {
            createTypedLine(proposal.getApproval(), activeEmp(empId), ApprovalLine.TYPE_AGREEMENT, order++, true);
        }
        boolean first = agreementIds.isEmpty();
        for (Long empId : approverIds) {
            Emp approver = activeEmp(empId);
            createTypedLine(proposal.getApproval(), approver, ApprovalLine.TYPE_APPROVAL, order++, first);
            first = false;
        }
        proposal.moveToPurchaseApproval();
        return response(proposal, currentEmp);
    }

    @Transactional
    public boolean progressAfterApproval(ApprovalDocument document, List<ApprovalLine> lines, ApprovalLine currentLine) {
        if (!ApprovalEquipmentProposal.TEMPLATE_CODE.equals(document.getTemplateCode())) {
            return false;
        }
        ApprovalEquipmentProposal proposal = proposalRepository.findByApprovalApprovalId(document.getApprovalId()).orElse(null);
        if (proposal == null) {
            return false;
        }
        if (ApprovalEquipmentProposal.STAGE_USER_APPROVAL.equals(proposal.getWorkflowStage())) {
            Emp peAssignee = defaultAssignee("PROD_TECH", "EQUIPMENT_PE_ASSIGNEE_NOT_FOUND");
            proposal.moveToPeInput(peAssignee);
            ApprovalLine line = createTypedLine(document, peAssignee, ApprovalLine.TYPE_APPROVAL, nextOrder(lines), true);
            notificationService.notifyEmp(peAssignee.getEmpId(), "설비 품의서 주관부서 작성", "사용부서 결재가 완료되어 생산기술팀 작성 단계로 전달되었습니다.", "APPROVAL", document.getApprovalId());
            lines.add(line);
            return true;
        }
        if (ApprovalEquipmentProposal.STAGE_PE_APPROVAL.equals(proposal.getWorkflowStage())) {
            Emp purchaseAssignee = defaultAssignee("PURCHASE", "EQUIPMENT_PURCHASE_ASSIGNEE_NOT_FOUND");
            proposal.moveToPurchaseInput(purchaseAssignee);
            ApprovalLine line = createTypedLine(document, purchaseAssignee, ApprovalLine.TYPE_APPROVAL, nextOrder(lines), true);
            notificationService.notifyEmp(purchaseAssignee.getEmpId(), "설비 품의서 구매 작성", "주관부서 결재가 완료되어 구매 작성 단계로 전달되었습니다.", "APPROVAL", document.getApprovalId());
            lines.add(line);
            return true;
        }
        if (ApprovalEquipmentProposal.STAGE_PURCHASE_APPROVAL.equals(proposal.getWorkflowStage())) {
            proposal.complete();
            return false;
        }
        return true;
    }

    @Transactional(readOnly = true)
    public void assertApprovalActionAllowed(ApprovalDocument document) {
        if (!ApprovalEquipmentProposal.TEMPLATE_CODE.equals(document.getTemplateCode())) {
            return;
        }
        ApprovalEquipmentProposal proposal = proposalRepository.findByApprovalApprovalId(document.getApprovalId()).orElse(null);
        if (proposal == null) {
            return;
        }
        if (ApprovalEquipmentProposal.STAGE_PE_INPUT.equals(proposal.getWorkflowStage())) {
            throw BusinessException.badRequest("EQUIPMENT_PE_SUBMIT_REQUIRED", "주관부서 의견과 설계 의견을 작성 완료한 뒤 승인할 수 있습니다");
        }
        if (ApprovalEquipmentProposal.STAGE_PURCHASE_INPUT.equals(proposal.getWorkflowStage())) {
            throw BusinessException.badRequest("EQUIPMENT_PURCHASE_SUBMIT_REQUIRED", "구매 작성란을 작성 완료한 뒤 승인할 수 있습니다");
        }
    }

    @Transactional(readOnly = true)
    public boolean canWriteAttachment(String targetType, Long approvalId, Emp emp) {
        ApprovalEquipmentProposal proposal = proposalRepository.findByApprovalApprovalId(approvalId).orElse(null);
        if (proposal == null) {
            return false;
        }
        if (ApprovalEquipmentProposal.TARGET_USER.equals(targetType)) {
            return canEditUserSection(emp, proposal);
        }
        if (ApprovalEquipmentProposal.TARGET_PE.equals(targetType)) {
            return canEditPeSection(emp, proposal);
        }
        if (ApprovalEquipmentProposal.TARGET_PURCHASE.equals(targetType)) {
            return canEditPurchaseSection(emp, proposal);
        }
        return false;
    }

    @Transactional(readOnly = true)
    public boolean isEquipmentAttachmentTarget(String targetType) {
        return ApprovalEquipmentProposal.TARGET_USER.equals(targetType)
            || ApprovalEquipmentProposal.TARGET_PE.equals(targetType)
            || ApprovalEquipmentProposal.TARGET_PURCHASE.equals(targetType);
    }

    private ApprovalEquipmentProposal getProposal(Long approvalId) {
        return proposalRepository.findByApprovalApprovalId(approvalId)
            .orElseThrow(() -> BusinessException.notFound("EQUIPMENT_PROPOSAL_NOT_FOUND", "Equipment proposal was not found"));
    }

    private ApprovalEquipmentProposal getProposalForUpdate(Long approvalId) {
        return proposalRepository.findByApprovalIdForUpdate(approvalId)
            .orElseThrow(() -> BusinessException.notFound("EQUIPMENT_PROPOSAL_NOT_FOUND", "Equipment proposal was not found"));
    }

    private EquipmentProposalResponse response(ApprovalEquipmentProposal proposal, Emp emp) {
        return EquipmentProposalResponse.from(
            proposal,
            canEditUserSection(emp, proposal),
            canEditPeSection(emp, proposal),
            canEditPurchaseSection(emp, proposal),
            canAssignPe(emp, proposal),
            canAssignPurchase(emp, proposal)
        );
    }

    private boolean canEditUserSection(Emp emp, ApprovalEquipmentProposal proposal) {
        return emp != null
            && proposal.getApproval().getRequester().getEmpId().equals(emp.getEmpId())
            && proposal.getApproval().isEditableDraft();
    }

    private boolean canEditPeSection(Emp emp, ApprovalEquipmentProposal proposal) {
        return emp != null
            && ApprovalEquipmentProposal.STAGE_PE_INPUT.equals(proposal.getWorkflowStage())
            && proposal.getPeAssignee() != null
            && proposal.getPeAssignee().getEmpId().equals(emp.getEmpId());
    }

    private boolean canEditPurchaseSection(Emp emp, ApprovalEquipmentProposal proposal) {
        return emp != null
            && ApprovalEquipmentProposal.STAGE_PURCHASE_INPUT.equals(proposal.getWorkflowStage())
            && proposal.getPurchaseAssignee() != null
            && proposal.getPurchaseAssignee().getEmpId().equals(emp.getEmpId());
    }

    private boolean canAssignPe(Emp emp, ApprovalEquipmentProposal proposal) {
        return emp != null
            && ApprovalEquipmentProposal.STAGE_PE_INPUT.equals(proposal.getWorkflowStage())
            && isDeptManager(emp, "PROD_TECH");
    }

    private boolean canAssignPurchase(Emp emp, ApprovalEquipmentProposal proposal) {
        return canEditPurchaseSection(emp, proposal);
    }

    private boolean isDeptManager(Emp emp, String deptCode) {
        return emp != null
            && emp.getDept() != null
            && deptCode.equals(emp.getDept().getDeptCode())
            && ("MANAGER".equals(emp.getRoleCode())
                || "APPROVAL_ADMIN".equals(emp.getRoleCode())
                || "ADMIN".equals(emp.getRoleCode())
                || containsTeamLeadTitle(emp.getJobTitle())
                || containsTeamLeadTitle(emp.getPositionName()));
    }

    private boolean containsTeamLeadTitle(String value) {
        return value != null && value.contains("팀장");
    }

    private ApprovalLine pendingLine(ApprovalDocument document, String stage) {
        return lineRepository.findByDocumentOrderByLineOrderAsc(document).stream()
            .filter(ApprovalLine::isApproval)
            .filter(line -> ApprovalLine.STATUS_PENDING.equals(line.getStatus()))
            .findFirst()
            .orElseThrow(() -> BusinessException.badRequest("EQUIPMENT_PROPOSAL_LINE_NOT_FOUND", "Current stage approval line was not found: " + stage));
    }

    private ApprovalLine createTypedLine(ApprovalDocument document, Emp assignee, String lineType, int lineOrder, boolean pending) {
        ApprovalLine line = ApprovalLine.builder()
            .document(document)
            .approver(assignee)
            .lineType(lineType)
            .lineOrder(lineOrder)
            .first(false)
            .build();
        if (pending) {
            line.open(reminderService.decisionDueAt());
        }
        return lineRepository.save(line);
    }

    private int nextOrder(List<ApprovalLine> lines) {
        return lines.stream().map(ApprovalLine::getLineOrder).max(Integer::compareTo).orElse(0) + 1;
    }

    private List<Long> ids(List<Long> empIds) {
        return empIds == null ? List.of() : empIds.stream().filter(id -> id != null).toList();
    }

    private void requireNoDuplicate(String errorCode, List<Long> empIds) {
        if (new HashSet<>(empIds).size() != empIds.size()) {
            throw BusinessException.badRequest(errorCode, "Approval line cannot contain duplicated assignees");
        }
    }

    private void requireNoOverlap(List<Long> agreementIds, List<Long> approverIds) {
        Set<Long> agreementSet = new HashSet<>(agreementIds);
        if (approverIds.stream().anyMatch(agreementSet::contains)) {
            throw BusinessException.badRequest("EQUIPMENT_PURCHASE_LINE_OVERLAP", "Purchase agreement and approval lines cannot overlap");
        }
    }

    private Emp defaultAssignee(String deptCode, String errorCode) {
        return empRepository.findActiveByDeptCodeOrderForRouting(deptCode).stream()
            .findFirst()
            .orElseThrow(() -> BusinessException.badRequest(errorCode, "Default assignee was not found for " + deptCode));
    }

    private Emp activeEmp(Long empId) {
        if (empId == null) {
            throw BusinessException.badRequest("EQUIPMENT_ASSIGNEE_REQUIRED", "Assignee is required");
        }
        Emp emp = empRepository.findById(empId)
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "Employee was not found"));
        if (!emp.isActiveUser()) {
            throw BusinessException.badRequest("EMP_INACTIVE", "Only active employees can be assigned");
        }
        return emp;
    }

    private void requireDept(Emp emp, String deptCode, String message) {
        if (emp.getDept() == null || !deptCode.equals(emp.getDept().getDeptCode())) {
            throw BusinessException.badRequest("EQUIPMENT_ASSIGNEE_DEPT_INVALID", message);
        }
    }

    private JsonNode formFields(String formDataJson) {
        if (formDataJson == null || formDataJson.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            JsonNode root = objectMapper.readTree(formDataJson);
            JsonNode fields = root.path("fields");
            return fields.isObject() ? fields : root;
        } catch (JsonProcessingException ex) {
            return objectMapper.createObjectNode();
        }
    }

    private String text(JsonNode fields, String name, String fallback) {
        JsonNode value = fields.get(name);
        if (value == null || value.isNull()) {
            return fallback;
        }
        return value.asText("");
    }

    private String requesterDeptName(ApprovalDocument document) {
        if (document.getRequester().getDept() == null) {
            return "";
        }
        return document.getRequester().getDept().getDeptName();
    }

    private String blankToDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }
}
