package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;

public interface ApprovalDocumentRepository extends JpaRepository<ApprovalDocument, Long> {

    Page<ApprovalDocument> findByDeletedYnOrderByApprovalIdDesc(String deletedYn, Pageable pageable);

    Page<ApprovalDocument> findByRequesterAndDeletedYnOrderByApprovalIdDesc(Emp requester, String deletedYn, Pageable pageable);

    @Query(value = """
        select coalesce(max(cast(substring(document_no from length(:prefixYear) + 1) as integer)), 0)
        from approval_document
        where document_no like concat(:prefixYear, '%')
        """, nativeQuery = true)
    int findMaxDocumentSequence(@Param("prefixYear") String prefixYear);

    @Query("""
        select d from ApprovalDocument d
        where d.deletedYn = 'N'
          and (:keyword is null or lower(coalesce(d.searchText, '')) like lower(concat('%', :keyword, '%')))
          and (:templateCode is null or d.templateCode = :templateCode)
          and (:status is null or d.status = :status)
          and (:requester is null or d.requester = :requester)
          and (
            :admin = true
            or d.requester = :currentEmp
            or exists (
              select 1 from ApprovalLine visibleLine
              where visibleLine.document = d
                and visibleLine.approver = :currentEmp
            )
          )
          and (:dateFrom is null or d.requestedAt >= :dateFrom)
          and (:dateTo is null or d.requestedAt < :dateTo)
        order by d.approvalId desc
        """)
    Page<ApprovalDocument> searchVisible(
        @Param("keyword") String keyword,
        @Param("templateCode") String templateCode,
        @Param("status") String status,
        @Param("requester") Emp requester,
        @Param("currentEmp") Emp currentEmp,
        @Param("admin") boolean admin,
        @Param("dateFrom") LocalDateTime dateFrom,
        @Param("dateTo") LocalDateTime dateTo,
        Pageable pageable
    );

    @Query("""
        select distinct d from ApprovalDocument d
        join ApprovalLine l on l.document = d
        where d.deletedYn = 'N'
          and l.approver = :approver
        order by d.approvalId desc
        """)
    Page<ApprovalDocument> findVisibleToApprover(@Param("approver") Emp approver, Pageable pageable);
}
