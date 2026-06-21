package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.exception.BusinessException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ApprovalLinePolicyService {

    private final ApprovalLineRepository lineRepository;
    private final EmpRepository empRepository;
    private final ApprovalDelegationService delegationService;
    private final ApprovalReminderService reminderService;

    public void validateLineSelection(Emp requester, ApprovalRequest request, boolean requireApprover) {
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
        requireActiveAssignees("AGREEMENT", agreementIds);
        requireActiveAssignees("APPROVAL", approverIds);
        requireActiveAssignees("RECEIVER", receiverIds);
        requireActiveAssignees("REFERENCE", ids(request.referenceEmpIds()));
        requireActiveAssignees("READER", ids(request.readerEmpIds()));
    }

    public void createLines(ApprovalDocument document, ApprovalRequest request, boolean submitted) {
        int order = 1;
        boolean hasAgreement = hasAgreement(request);
        order = createTypedLines(document, ids(request.agreementEmpIds()), ApprovalLine.TYPE_AGREEMENT, order, submitted);
        order = createTypedLines(document, ids(request.approverEmpIds()), ApprovalLine.TYPE_APPROVAL, order, submitted && !hasAgreement);
        order = createTypedLines(document, ids(request.receiverEmpIds()), ApprovalLine.TYPE_RECEIVER, order, false);
        order = createTypedLines(document, ids(request.referenceEmpIds()), ApprovalLine.TYPE_REFERENCE, order, false);
        createTypedLines(document, ids(request.readerEmpIds()), ApprovalLine.TYPE_READER, order, false);
    }

    public ApprovalLine currentDecisionLineForUpdate(List<ApprovalLine> lines, Emp currentEmp) {
        ApprovalLine candidate = lines.stream()
            .filter(ApprovalLine::isDecisionLine)
            .filter(line -> line.isPendingFor(currentEmp) || (ApprovalLine.STATUS_PENDING.equals(line.getStatus()) && delegationService.canActFor(currentEmp, line.getAssignedEmp())))
            .findFirst()
            .orElseThrow(() -> BusinessException.forbidden("APPROVAL_FORBIDDEN", "Only the current agreement or approver can process this document"));
        ApprovalLine locked = lineRepository.findByIdForUpdate(candidate.getLineId())
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_LINE_NOT_FOUND", "Approval line was not found"));
        if (!locked.isDecisionLine()
            || !ApprovalLine.STATUS_PENDING.equals(locked.getStatus())
            || !(locked.isPendingFor(currentEmp) || delegationService.canActFor(currentEmp, locked.getAssignedEmp()))) {
            throw BusinessException.badRequest("APPROVAL_ALREADY_PROCESSED", "This approval line has already been processed");
        }
        return locked;
    }

    public ApprovalLine receiverLineForUpdate(List<ApprovalLine> lines, Emp currentEmp) {
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

    public boolean hasAgreement(ApprovalRequest request) {
        return !ids(request.agreementEmpIds()).isEmpty();
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
                line.open(reminderService.decisionDueAt());
            }
            lineRepository.save(line);
        }
        return order;
    }

    private void requireNoDuplicate(String lineType, List<Long> empIds) {
        if (new HashSet<>(empIds).size() != empIds.size()) {
            throw BusinessException.badRequest("APPROVAL_INVALID_LINE", lineType + " assignees cannot contain duplicates");
        }
    }

    private void requireActiveAssignees(String lineType, List<Long> empIds) {
        for (Long empId : new HashSet<>(empIds)) {
            if (empId == null) {
                throw BusinessException.badRequest("APPROVAL_INVALID_LINE", lineType + " assignee is required");
            }
            Emp assignee = empRepository.findById(empId)
                .orElseThrow(() -> BusinessException.notFound("APPROVAL_ASSIGNEE_NOT_FOUND", "Approval assignee was not found"));
            if (!assignee.isActiveUser()) {
                throw BusinessException.badRequest(
                    "APPROVAL_ASSIGNEE_INACTIVE",
                    "재직 중인 사용자만 결재선에 지정할 수 있습니다: " + assignee.getEmpName()
                );
            }
        }
    }

    private List<Long> concat(List<Long> first, List<Long> second, List<Long> third) {
        List<Long> result = new ArrayList<>(first);
        result.addAll(second);
        result.addAll(third);
        return result;
    }

    private List<Long> ids(Collection<Long> empIds) {
        return empIds == null ? List.of() : empIds.stream().toList();
    }
}
