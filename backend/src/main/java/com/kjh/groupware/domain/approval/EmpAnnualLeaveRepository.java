package com.kjh.groupware.domain.approval;

import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmpAnnualLeaveRepository extends JpaRepository<EmpAnnualLeave, Long> {
    Optional<EmpAnnualLeave> findByEmpEmpIdAndLeaveYear(Long empId, int leaveYear);
    List<EmpAnnualLeave> findByLeaveYearOrderByEmpEmpNameAsc(int leaveYear);
}
