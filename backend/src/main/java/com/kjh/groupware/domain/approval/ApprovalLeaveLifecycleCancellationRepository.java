package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalLeaveLifecycleCancellationRepository extends JpaRepository<ApprovalLeaveLifecycleCancellation, Long> {
    List<ApprovalLeaveLifecycleCancellation> findByEmpAndActiveYn(Emp emp, String activeYn);
    boolean existsByDocumentAndLeaveDateAndLeaveTypeAndCancellationType(ApprovalDocument document, java.time.LocalDate leaveDate, String leaveType, String cancellationType);
}
