package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalDelegationRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalDelegationResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalDelegationService {

    private final ApprovalDelegationRepository delegationRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;

    @Transactional(readOnly = true)
    public ApprovalDelegationResponse getMine() {
        Emp owner = currentEmpProvider.getCurrentEmp();
        return delegationRepository.findTopByOwnerEmpAndDeletedYnOrderByDelegationIdDesc(owner, "N")
            .map(ApprovalDelegationResponse::from)
            .orElse(null);
    }

    @Transactional
    public ApprovalDelegationResponse saveMine(ApprovalDelegationRequest request, String ipAddress, String userAgent) {
        if (request == null || request.delegateEmpId() == null) {
            throw BusinessException.badRequest("APPROVAL_DELEGATE_REQUIRED", "대리자를 선택해 주세요.");
        }
        Emp owner = currentEmpProvider.getCurrentEmp();
        Emp delegate = empRepository.findById(request.delegateEmpId())
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_DELEGATE_NOT_FOUND", "대리자를 찾을 수 없습니다."));
        validate(owner, delegate, request.startDate(), request.endDate());

        boolean active = request.active() == null || request.active();
        ApprovalDelegation delegation = delegationRepository.findTopByOwnerEmpAndDeletedYnOrderByDelegationIdDesc(owner, "N")
            .orElseGet(() -> delegationRepository.save(ApprovalDelegation.builder()
                .ownerEmp(owner)
                .delegateEmp(delegate)
                .startDate(safeStartDate(request.startDate()))
                .endDate(request.endDate())
                .reason(request.reason())
                .activeYn(active ? "Y" : "N")
                .build()));
        delegation.update(delegate, safeStartDate(request.startDate()), request.endDate(), request.reason(), active);
        auditLogService.record(owner.getEmpId(), AuditActionType.SET_DELEGATION, "approval_delegation", delegation.getDelegationId(), ipAddress, userAgent);
        return ApprovalDelegationResponse.from(delegation);
    }

    @Transactional
    public void deleteMine(String ipAddress, String userAgent) {
        Emp owner = currentEmpProvider.getCurrentEmp();
        ApprovalDelegation delegation = delegationRepository.findTopByOwnerEmpAndDeletedYnOrderByDelegationIdDesc(owner, "N")
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_DELEGATION_NOT_FOUND", "설정된 대리결재자가 없습니다."));
        delegation.delete();
        auditLogService.record(owner.getEmpId(), AuditActionType.CANCEL_DELEGATION, "approval_delegation", delegation.getDelegationId(), ipAddress, userAgent);
    }

    @Transactional(readOnly = true)
    public List<Emp> decisionAssigneesFor(Emp actor) {
        List<Emp> assignees = new ArrayList<>();
        if (actor == null) {
            return assignees;
        }
        assignees.add(actor);
        delegationRepository.findActiveByDelegate(actor, LocalDate.now()).stream()
            .map(ApprovalDelegation::getOwnerEmp)
            .filter(owner -> owner != null)
            .filter(owner -> assignees.stream().noneMatch(saved -> saved.getEmpId().equals(owner.getEmpId())))
            .forEach(assignees::add);
        return assignees;
    }

    @Transactional(readOnly = true)
    public boolean canActFor(Emp actor, Emp owner) {
        if (actor == null || owner == null) {
            return false;
        }
        if (actor.getEmpId().equals(owner.getEmpId())) {
            return true;
        }
        return delegationRepository.findActiveByOwnerAndDelegate(owner, actor, LocalDate.now()).isPresent();
    }

    @Transactional(readOnly = true)
    public List<Emp> activeDelegatesFor(Emp owner) {
        if (owner == null) {
            return List.of();
        }
        return delegationRepository.findActiveByOwner(owner, LocalDate.now()).stream()
            .map(ApprovalDelegation::getDelegateEmp)
            .filter(delegate -> delegate != null && delegate.isActiveUser())
            .distinct()
            .toList();
    }

    private void validate(Emp owner, Emp delegate, LocalDate startDate, LocalDate endDate) {
        if (owner.getEmpId().equals(delegate.getEmpId())) {
            throw BusinessException.badRequest("APPROVAL_DELEGATE_SELF", "본인은 대리자로 지정할 수 없습니다.");
        }
        if (!delegate.isActiveUser()) {
            throw BusinessException.badRequest("APPROVAL_DELEGATE_INACTIVE", "재직 중인 사용자만 대리자로 지정할 수 있습니다.");
        }
        LocalDate safeStart = safeStartDate(startDate);
        if (endDate != null && endDate.isBefore(safeStart)) {
            throw BusinessException.badRequest("APPROVAL_DELEGATION_INVALID_PERIOD", "대리 종료일은 시작일보다 빠를 수 없습니다.");
        }
    }

    private LocalDate safeStartDate(LocalDate startDate) {
        return startDate == null ? LocalDate.now() : startDate;
    }
}
