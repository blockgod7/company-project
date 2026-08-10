package com.kjh.groupware.domain.approval;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeavePolicyRepository extends JpaRepository<LeavePolicy, Long> {

    List<LeavePolicy> findAllByOrderByLeaveTypeAscEffectiveFromDesc();

    @Query("""
        select p from LeavePolicy p
        where p.effectiveFrom <= :date
          and (p.effectiveTo is null or p.effectiveTo >= :date)
        order by p.leaveType asc, p.effectiveFrom desc, p.leavePolicyId desc
        """)
    List<LeavePolicy> findAllEffective(@Param("date") LocalDate date);

    @Query("""
        select p from LeavePolicy p
        where p.leaveType = :leaveType
          and p.effectiveFrom <= :date
          and (p.effectiveTo is null or p.effectiveTo >= :date)
        order by p.effectiveFrom desc, p.leavePolicyId desc
        """)
    List<LeavePolicy> findEffective(@Param("leaveType") String leaveType, @Param("date") LocalDate date);

    @Query("""
        select p from LeavePolicy p
        where p.leaveType = :leaveType
          and p.leavePolicyId <> :excludeId
          and p.effectiveFrom <= :endDate
          and (p.effectiveTo is null or p.effectiveTo >= :startDate)
        """)
    List<LeavePolicy> findOverlaps(
        @Param("leaveType") String leaveType,
        @Param("excludeId") Long excludeId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );
}
