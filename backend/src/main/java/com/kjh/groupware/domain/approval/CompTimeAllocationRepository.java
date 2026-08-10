package com.kjh.groupware.domain.approval;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompTimeAllocationRepository extends JpaRepository<CompTimeAllocation, Long> {
    List<CompTimeAllocation> findByApprovalAndStatusInOrderByLeaveDateAscAllocationIdAsc(
        ApprovalDocument approval,
        Collection<String> statuses
    );

    List<CompTimeAllocation> findByApprovalRequesterEmpIdAndLeaveDateAndStatusOrderByAllocationIdAsc(
        Long empId,
        LocalDate leaveDate,
        String status
    );

    List<CompTimeAllocation> findByRestoredByApprovalAndStatusOrderByAllocationIdAsc(
        ApprovalDocument restoredByApproval,
        String status
    );

    List<CompTimeAllocation> findByApprovalAndLeaveDateAndStatusAndStatusReasonOrderByAllocationIdAsc(
        ApprovalDocument approval,
        LocalDate leaveDate,
        String status,
        String statusReason
    );
}
