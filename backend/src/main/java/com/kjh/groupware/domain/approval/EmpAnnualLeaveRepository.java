package com.kjh.groupware.domain.approval;

import java.util.*;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmpAnnualLeaveRepository extends JpaRepository<EmpAnnualLeave, Long> {
    Optional<EmpAnnualLeave> findByEmpEmpIdAndLeaveYear(Long empId, int leaveYear);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select annualLeave from EmpAnnualLeave annualLeave where annualLeave.emp.empId = :empId and annualLeave.leaveYear = :leaveYear")
    Optional<EmpAnnualLeave> findByEmpEmpIdAndLeaveYearForUpdate(
        @Param("empId") Long empId,
        @Param("leaveYear") int leaveYear
    );

    List<EmpAnnualLeave> findByLeaveYearOrderByEmpEmpNameAsc(int leaveYear);
}
