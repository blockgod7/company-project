package com.kjh.groupware.domain.approval;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalLeaveAdminCaseRepository extends JpaRepository<ApprovalLeaveAdminCase, Long> {
    Optional<ApprovalLeaveAdminCase> findByApproval(ApprovalDocument approval);
}
