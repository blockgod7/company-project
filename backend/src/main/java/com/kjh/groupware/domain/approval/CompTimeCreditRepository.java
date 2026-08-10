package com.kjh.groupware.domain.approval;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompTimeCreditRepository extends JpaRepository<CompTimeCredit, Long> {
    boolean existsByEmpEmpIdAndWorkDate(Long empId, LocalDate workDate);

    List<CompTimeCredit> findByEmpEmpIdOrderByExpiresOnAscWorkDateAsc(Long empId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from CompTimeCredit c where c.creditId = :creditId")
    Optional<CompTimeCredit> findByIdForUpdate(@Param("creditId") Long creditId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select c from CompTimeCredit c
        where c.emp.empId = :empId
          and c.expiresOn >= :minimumExpiry
        order by c.expiresOn asc, c.workDate asc, c.creditId asc
        """)
    List<CompTimeCredit> findUsableForUpdate(@Param("empId") Long empId, @Param("minimumExpiry") LocalDate minimumExpiry);

    @Query("""
        select c from CompTimeCredit c
        where c.expiresOn < :today
          and c.expirationNotifiedAt is null
          and c.grantedDays > c.usedDays
        order by c.expiresOn asc, c.creditId asc
        """)
    List<CompTimeCredit> findUnnotifiedExpired(@Param("today") LocalDate today);
}
