package com.kjh.groupware.domain.emp;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmpLeavePeriodRepository extends JpaRepository<EmpLeavePeriod, Long> {
    Optional<EmpLeavePeriod> findFirstByEmpEmpIdAndStatusOrderByStartDateDesc(Long empId, String status);
    List<EmpLeavePeriod> findByEmpEmpIdOrderByStartDateDesc(Long empId);
}
