package com.kjh.groupware.domain.approval;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnnualLeaveLedgerRepository extends JpaRepository<AnnualLeaveLedger, Long> {
    List<AnnualLeaveLedger> findByEmpEmpIdAndLeaveYearOrderByAnnualLeaveLedgerIdDesc(Long empId, int leaveYear);
}
