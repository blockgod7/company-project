package com.kjh.groupware.domain.approval;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeavePolicyOverrideRepository extends JpaRepository<LeavePolicyOverride, Long> {
    Optional<LeavePolicyOverride> findFirstByEmpEmpIdAndLeaveTypeAndReferenceDateAndActiveYnOrderByPolicyOverrideIdDesc(
        Long empId,
        String leaveType,
        LocalDate referenceDate,
        String activeYn
    );

    List<LeavePolicyOverride> findByEmpEmpIdAndLeaveTypeOrderByPolicyOverrideIdDesc(Long empId, String leaveType);
}
