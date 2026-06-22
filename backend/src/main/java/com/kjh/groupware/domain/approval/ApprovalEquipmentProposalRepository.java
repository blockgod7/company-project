package com.kjh.groupware.domain.approval;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface ApprovalEquipmentProposalRepository extends JpaRepository<ApprovalEquipmentProposal, Long> {

    Optional<ApprovalEquipmentProposal> findByApprovalApprovalId(Long approvalId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from ApprovalEquipmentProposal p where p.approvalId = :approvalId")
    Optional<ApprovalEquipmentProposal> findByApprovalIdForUpdate(@Param("approvalId") Long approvalId);
}
