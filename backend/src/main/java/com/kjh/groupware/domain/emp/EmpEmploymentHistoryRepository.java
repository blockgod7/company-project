package com.kjh.groupware.domain.emp;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmpEmploymentHistoryRepository extends JpaRepository<EmpEmploymentHistory, Long> {
    List<EmpEmploymentHistory> findByEmpEmpIdOrderByStartDateDesc(Long empId);
    Optional<EmpEmploymentHistory> findFirstByEmpEmpIdAndEndDateIsNullOrderByStartDateDesc(Long empId);
}
