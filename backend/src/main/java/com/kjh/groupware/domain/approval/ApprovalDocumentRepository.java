package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApprovalDocumentRepository extends JpaRepository<ApprovalDocument, Long> {

    Page<ApprovalDocument> findByDeletedYnOrderByApprovalIdDesc(String deletedYn, Pageable pageable);

    Page<ApprovalDocument> findByRequesterAndDeletedYnOrderByApprovalIdDesc(Emp requester, String deletedYn, Pageable pageable);

    @Query("""
        select distinct d from ApprovalDocument d
        join ApprovalLine l on l.document = d
        where d.deletedYn = 'N'
          and l.approver = :approver
        order by d.approvalId desc
        """)
    Page<ApprovalDocument> findVisibleToApprover(@Param("approver") Emp approver, Pageable pageable);
}
