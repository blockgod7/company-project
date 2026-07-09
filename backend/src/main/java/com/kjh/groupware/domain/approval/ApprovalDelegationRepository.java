package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApprovalDelegationRepository extends JpaRepository<ApprovalDelegation, Long> {

    Optional<ApprovalDelegation> findTopByOwnerEmpAndDeletedYnOrderByDelegationIdDesc(Emp ownerEmp, String deletedYn);

    Optional<ApprovalDelegation> findTopByOwnerEmpAndDelegationTypeAndDeletedYnOrderByDelegationIdDesc(
        Emp ownerEmp,
        String delegationType,
        String deletedYn
    );

    @Query("""
        select d from ApprovalDelegation d
        where d.delegateEmp = :delegateEmp
          and d.activeYn = 'Y'
          and d.deletedYn = 'N'
          and d.delegationType <> 'DEFAULT'
          and d.startDate <= :targetDate
          and (d.endDate is null or d.endDate >= :targetDate)
        order by d.delegationId desc
        """)
    List<ApprovalDelegation> findActiveByDelegate(@Param("delegateEmp") Emp delegateEmp, @Param("targetDate") LocalDate targetDate);

    @Query("""
        select d from ApprovalDelegation d
        where d.ownerEmp = :ownerEmp
          and d.activeYn = 'Y'
          and d.deletedYn = 'N'
          and d.delegationType <> 'DEFAULT'
          and d.startDate <= :targetDate
          and (d.endDate is null or d.endDate >= :targetDate)
        order by d.delegationId desc
        """)
    List<ApprovalDelegation> findActiveByOwner(@Param("ownerEmp") Emp ownerEmp, @Param("targetDate") LocalDate targetDate);

    @Query("""
        select d from ApprovalDelegation d
        where d.ownerEmp = :ownerEmp
          and d.delegateEmp = :delegateEmp
          and d.activeYn = 'Y'
          and d.deletedYn = 'N'
          and d.delegationType <> 'DEFAULT'
          and d.startDate <= :targetDate
          and (d.endDate is null or d.endDate >= :targetDate)
        """)
    Optional<ApprovalDelegation> findActiveByOwnerAndDelegate(
        @Param("ownerEmp") Emp ownerEmp,
        @Param("delegateEmp") Emp delegateEmp,
        @Param("targetDate") LocalDate targetDate
    );

    @Query("""
        select d from ApprovalDelegation d
        where d.delegateEmp = :delegateEmp
          and d.activeYn = 'Y'
          and d.deletedYn = 'N'
          and d.delegationType <> 'DEFAULT'
          and (
            (
              d.startAt is not null
              and d.startAt <= :targetDateTime
              and (d.endAt is null or d.endAt > :targetDateTime)
            )
            or (
              d.startAt is null
              and d.startDate <= :targetDate
              and (d.endDate is null or d.endDate >= :targetDate)
            )
          )
        order by d.delegationId desc
        """)
    List<ApprovalDelegation> findActiveByDelegateAt(
        @Param("delegateEmp") Emp delegateEmp,
        @Param("targetDateTime") LocalDateTime targetDateTime,
        @Param("targetDate") LocalDate targetDate
    );

    @Query("""
        select d from ApprovalDelegation d
        where d.ownerEmp = :ownerEmp
          and d.activeYn = 'Y'
          and d.deletedYn = 'N'
          and d.delegationType <> 'DEFAULT'
          and (
            (
              d.startAt is not null
              and d.startAt <= :targetDateTime
              and (d.endAt is null or d.endAt > :targetDateTime)
            )
            or (
              d.startAt is null
              and d.startDate <= :targetDate
              and (d.endDate is null or d.endDate >= :targetDate)
            )
          )
        order by d.delegationId desc
        """)
    List<ApprovalDelegation> findActiveByOwnerAt(
        @Param("ownerEmp") Emp ownerEmp,
        @Param("targetDateTime") LocalDateTime targetDateTime,
        @Param("targetDate") LocalDate targetDate
    );

    @Query("""
        select d from ApprovalDelegation d
        where d.ownerEmp = :ownerEmp
          and d.delegateEmp = :delegateEmp
          and d.activeYn = 'Y'
          and d.deletedYn = 'N'
          and d.delegationType <> 'DEFAULT'
          and (
            (
              d.startAt is not null
              and d.startAt <= :targetDateTime
              and (d.endAt is null or d.endAt > :targetDateTime)
            )
            or (
              d.startAt is null
              and d.startDate <= :targetDate
              and (d.endDate is null or d.endDate >= :targetDate)
            )
          )
        """)
    Optional<ApprovalDelegation> findActiveByOwnerAndDelegateAt(
        @Param("ownerEmp") Emp ownerEmp,
        @Param("delegateEmp") Emp delegateEmp,
        @Param("targetDateTime") LocalDateTime targetDateTime,
        @Param("targetDate") LocalDate targetDate
    );
}
