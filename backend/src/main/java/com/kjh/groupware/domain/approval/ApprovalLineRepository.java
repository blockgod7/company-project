package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface ApprovalLineRepository extends JpaRepository<ApprovalLine, Long> {

    List<ApprovalLine> findByDocumentOrderByLineOrderAsc(ApprovalDocument document);

    Optional<ApprovalLine> findByDocumentAndStatus(ApprovalDocument document, String status);

    void deleteByDocument(ApprovalDocument document);

    Page<ApprovalLine> findByApproverAndStatusOrderByLineIdDesc(Emp approver, String status, Pageable pageable);

    Page<ApprovalLine> findByApproverAndStatusInOrderByLineIdDesc(Emp approver, Collection<String> statuses, Pageable pageable);

    Page<ApprovalLine> findByAssignedEmpAndLineTypeAndStatusOrderByLineIdDesc(Emp assignedEmp, String lineType, String status, Pageable pageable);

    Page<ApprovalLine> findByAssignedEmpInAndLineTypeAndStatusOrderByLineIdDesc(Collection<Emp> assignedEmps, String lineType, String status, Pageable pageable);

    Page<ApprovalLine> findByAssignedEmpInAndLineTypeInAndStatusOrderByLineIdDesc(
        Collection<Emp> assignedEmps,
        Collection<String> lineTypes,
        String status,
        Pageable pageable
    );

    Page<ApprovalLine> findByAssignedEmpAndLineTypeInAndStatusInOrderByLineIdDesc(
        Emp assignedEmp,
        Collection<String> lineTypes,
        Collection<String> statuses,
        Pageable pageable
    );

    @Query("""
        select l from ApprovalLine l
        join l.document d
        where d.deletedYn = 'N'
          and l.assignedEmp = :assignedEmp
          and l.lineType = 'RECEIVER'
          and l.status in ('RECEIVED', 'READ')
          and not exists (
            select 1 from ApprovalLine decisionLine
            where decisionLine.document = d
              and decisionLine.lineType in ('AGREEMENT', 'APPROVAL')
              and decisionLine.lineOrder > l.lineOrder
          )
        order by l.lineId desc
        """)
    Page<ApprovalLine> findOpenReceiverInboxLines(@Param("assignedEmp") Emp assignedEmp, Pageable pageable);

    Page<ApprovalLine> findByAssignedEmpAndStatusInOrderByLineIdDesc(Emp assignedEmp, Collection<String> statuses, Pageable pageable);

    Page<ApprovalLine> findByAssignedEmpInAndStatusInOrderByLineIdDesc(Collection<Emp> assignedEmps, Collection<String> statuses, Pageable pageable);

    @Query("""
        select count(l) from ApprovalLine l
        join l.document d
        where d.deletedYn = 'N'
          and l.assignedEmp in :assignedEmps
          and l.lineType in :lineTypes
          and l.status = :status
        """)
    long countByAssignedEmpInAndLineTypeInAndStatus(
        @Param("assignedEmps") Collection<Emp> assignedEmps,
        @Param("lineTypes") Collection<String> lineTypes,
        @Param("status") String status
    );

    @Query("""
        select count(l) from ApprovalLine l
        join l.document d
        where d.deletedYn = 'N'
          and l.assignedEmp in :assignedEmps
          and l.lineType in :lineTypes
          and l.status = :status
          and l.dueAt is not null
          and l.dueAt < :now
        """)
    long countOverdueByAssignedEmpIn(
        @Param("assignedEmps") Collection<Emp> assignedEmps,
        @Param("lineTypes") Collection<String> lineTypes,
        @Param("status") String status,
        @Param("now") LocalDateTime now
    );

    @Query("""
        select l from ApprovalLine l
        join l.document d
        where d.deletedYn = 'N'
          and l.assignedEmp in :assignedEmps
          and l.lineType in :lineTypes
          and l.status = :status
          and l.dueAt is not null
          and l.dueAt < :now
        order by l.dueAt asc, l.lineId desc
        """)
    Page<ApprovalLine> findOverdueByAssignedEmpIn(
        @Param("assignedEmps") Collection<Emp> assignedEmps,
        @Param("lineTypes") Collection<String> lineTypes,
        @Param("status") String status,
        @Param("now") LocalDateTime now,
        Pageable pageable
    );

    @Query("""
        select l from ApprovalLine l
        join fetch l.document d
        join fetch l.assignedEmp e
        where l.status = :status
          and l.dueAt is not null
          and l.dueAt < :now
          and l.remindedAt is null
          and d.deletedYn = 'N'
        order by l.dueAt asc, l.lineId asc
        """)
    List<ApprovalLine> findDueForReminder(@Param("status") String status, @Param("now") LocalDateTime now);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from ApprovalLine l join fetch l.document where l.lineId = :lineId")
    Optional<ApprovalLine> findByIdForUpdate(@Param("lineId") Long lineId);
}
