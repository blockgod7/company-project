package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import jakarta.persistence.LockModeType;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ApprovalDocumentRepository extends JpaRepository<ApprovalDocument, Long> {

    Page<ApprovalDocument> findByDeletedYnOrderByApprovalIdDesc(String deletedYn, Pageable pageable);

    Page<ApprovalDocument> findByDeletedYn(String deletedYn, Pageable pageable);

    Page<ApprovalDocument> findByRequesterAndDeletedYnOrderByApprovalIdDesc(Emp requester, String deletedYn, Pageable pageable);

    Page<ApprovalDocument> findByRequesterAndDeletedYnAndStatusOrderByApprovalIdDesc(
        Emp requester,
        String deletedYn,
        String status,
        Pageable pageable
    );

    Page<ApprovalDocument> findByRequesterAndDeletedYnAndStatusInAndCompletedAtAfterOrderByCompletedAtDesc(
        Emp requester,
        String deletedYn,
        Collection<String> statuses,
        LocalDateTime completedAt,
        Pageable pageable
    );

    java.util.List<ApprovalDocument> findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
        Emp requester,
        String deletedYn,
        String templateCode,
        String status
    );

    long countByRequesterAndDeletedYnAndStatus(Emp requester, String deletedYn, String status);

    long countByRequesterAndDeletedYnAndStatusInAndCompletedAtAfter(
        Emp requester,
        String deletedYn,
        Collection<String> statuses,
        LocalDateTime completedAt
    );

    @Query(value = """
        select coalesce(max(cast(substring(document_no from length(:prefixYear) + 1) as integer)), 0)
        from approval_document
        where document_no like concat(:prefixYear, '%')
        """, nativeQuery = true)
    int findMaxDocumentSequence(@Param("prefixYear") String prefixYear);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from ApprovalDocument d where d.approvalId = :approvalId")
    Optional<ApprovalDocument> findByIdForUpdate(@Param("approvalId") Long approvalId);

    @Query("""
        select d from ApprovalDocument d
        where d.deletedYn = 'N'
          and (:hasKeyword = false or lower(coalesce(d.searchText, '')) like lower(concat('%', :keyword, '%')))
          and (:hasTemplateCode = false or d.templateCode = :templateCode)
          and (:hasStatus = false or d.status = :status)
          and (:hasRequester = false or d.requester = :requester)
          and (
            (:boxAll = true and :admin = true)
            or (:boxRequested = true and d.requester = :currentEmp)
            or (:boxAgreement = true and exists (
              select 1 from ApprovalLine agreementLine
              where agreementLine.document = d
                and agreementLine.assignedEmp in :decisionAssignees
                and agreementLine.lineType = 'AGREEMENT'
                and agreementLine.status = 'PENDING'
            ))
            or (:boxPending = true and exists (
              select 1 from ApprovalLine pendingLine
              where pendingLine.document = d
                and pendingLine.assignedEmp in :decisionAssignees
                and pendingLine.lineType = 'APPROVAL'
                and pendingLine.status = 'PENDING'
            ))
            or (:boxReceived = true and exists (
              select 1 from ApprovalLine receivedLine
              where receivedLine.document = d
                and receivedLine.assignedEmp = :currentEmp
                and receivedLine.lineType = 'RECEIVER'
                and receivedLine.status in ('RECEIVED', 'READ')
                and not exists (
                  select 1 from ApprovalLine receiverDecisionLine
                  where receiverDecisionLine.document = d
                    and receiverDecisionLine.lineType in ('AGREEMENT', 'APPROVAL')
                    and receiverDecisionLine.lineOrder > receivedLine.lineOrder
                )
            ))
            or (:boxShared = true and exists (
              select 1 from ApprovalLine sharedLine
              where sharedLine.document = d
                and sharedLine.assignedEmp = :currentEmp
                and sharedLine.lineType in ('REFERENCE', 'READER')
                and sharedLine.status = 'READ'
            ))
            or (:boxProcessed = true and exists (
              select 1 from ApprovalLine processedLine
              where processedLine.document = d
                and processedLine.assignedEmp in :decisionAssignees
                and processedLine.status in ('APPROVED', 'REJECTED', 'RECEIPT_COMPLETED')
            ))
            or (:boxVisible = true and (
              d.requester = :currentEmp
              or exists (
              select 1 from ApprovalLine visibleLine
              where visibleLine.document = d
                and visibleLine.assignedEmp = :currentEmp
              )
            )
            )
          )
          and (:hasDateFrom = false or d.requestedAt >= :dateFrom)
          and (:hasDateTo = false or d.requestedAt < :dateTo)
        order by d.approvalId desc
        """)
    Page<ApprovalDocument> searchVisible(
        @Param("hasKeyword") boolean hasKeyword,
        @Param("keyword") String keyword,
        @Param("hasTemplateCode") boolean hasTemplateCode,
        @Param("templateCode") String templateCode,
        @Param("hasStatus") boolean hasStatus,
        @Param("status") String status,
        @Param("hasRequester") boolean hasRequester,
        @Param("requester") Emp requester,
        @Param("currentEmp") Emp currentEmp,
        @Param("decisionAssignees") Collection<Emp> decisionAssignees,
        @Param("admin") boolean admin,
        @Param("boxAgreement") boolean boxAgreement,
        @Param("boxPending") boolean boxPending,
        @Param("boxReceived") boolean boxReceived,
        @Param("boxShared") boolean boxShared,
        @Param("boxProcessed") boolean boxProcessed,
        @Param("boxRequested") boolean boxRequested,
        @Param("boxAll") boolean boxAll,
        @Param("boxVisible") boolean boxVisible,
        @Param("hasDateFrom") boolean hasDateFrom,
        @Param("dateFrom") LocalDateTime dateFrom,
        @Param("hasDateTo") boolean hasDateTo,
        @Param("dateTo") LocalDateTime dateTo,
        Pageable pageable
    );

    @Query("""
        select distinct d from ApprovalDocument d
        join ApprovalLine l on l.document = d
        where d.deletedYn = 'N'
          and (
            (
              l.assignedEmp in :decisionAssignees
              and l.lineType in ('AGREEMENT', 'APPROVAL')
              and l.status = 'PENDING'
            )
            or (
              l.assignedEmp = :currentEmp
              and l.lineType in ('REFERENCE', 'READER')
              and l.status = 'READ'
            )
            or (
              l.assignedEmp = :currentEmp
              and l.lineType = 'RECEIVER'
              and l.status in ('RECEIVED', 'READ')
              and not exists (
                select 1 from ApprovalLine receiverDecisionLine
                where receiverDecisionLine.document = d
                  and receiverDecisionLine.lineType in ('AGREEMENT', 'APPROVAL')
                  and receiverDecisionLine.lineOrder > l.lineOrder
              )
            )
          )
        order by d.approvalId desc
        """)
    Page<ApprovalDocument> findActionRequiredDocuments(
        @Param("decisionAssignees") Collection<Emp> decisionAssignees,
        @Param("currentEmp") Emp currentEmp,
        Pageable pageable
    );

    @Query("""
        select distinct d from ApprovalDocument d
        join ApprovalLine myLine on myLine.document = d
        where d.deletedYn = 'N'
          and d.status = 'IN_PROGRESS'
          and d.requester <> :currentEmp
          and myLine.lineType in ('AGREEMENT', 'APPROVAL')
          and myLine.status = 'APPROVED'
          and (myLine.actedEmp = :currentEmp or myLine.assignedEmp = :currentEmp)
          and exists (
            select 1 from ApprovalLine nextLine
            where nextLine.document = d
              and nextLine.lineType in ('AGREEMENT', 'APPROVAL')
              and nextLine.lineOrder > myLine.lineOrder
              and nextLine.status in ('WAITING', 'PENDING')
          )
        order by d.approvalId desc
        """)
    Page<ApprovalDocument> findApprovedByMeAndStillInProgress(
        @Param("currentEmp") Emp currentEmp,
        Pageable pageable
    );

    @Query("""
        select distinct d from ApprovalDocument d
        join ApprovalLine myLine on myLine.document = d
        where d.deletedYn = 'N'
          and d.status = 'IN_PROGRESS'
          and myLine.lineType in ('AGREEMENT', 'APPROVAL')
          and (
            (
              myLine.status = 'APPROVED'
              and (myLine.actedEmp = :currentEmp or myLine.assignedEmp = :currentEmp)
              and exists (
                select 1 from ApprovalLine nextLine
                where nextLine.document = d
                  and nextLine.lineType in ('AGREEMENT', 'APPROVAL')
                  and nextLine.lineOrder > myLine.lineOrder
                  and nextLine.status in ('WAITING', 'PENDING')
              )
            )
            or (
              myLine.assignedEmp = :currentEmp
              and myLine.status = 'WAITING'
              and exists (
                select 1 from ApprovalLine previousLine
                where previousLine.document = d
                  and previousLine.lineType in ('AGREEMENT', 'APPROVAL')
                  and previousLine.lineOrder < myLine.lineOrder
                  and previousLine.status in ('WAITING', 'PENDING')
              )
            )
          )
        order by d.approvalId desc
        """)
    Page<ApprovalDocument> findApprovalInProgressForMe(
        @Param("currentEmp") Emp currentEmp,
        Pageable pageable
    );

    @Query("""
        select distinct d from ApprovalDocument d
        where d.deletedYn = 'N'
          and d.status in ('APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELED')
          and (:hasKeyword = false or lower(coalesce(d.searchText, '')) like lower(concat('%', :keyword, '%')))
          and (:hasTemplateCode = false or d.templateCode = :templateCode)
          and (:hasStatus = false or d.status = :status)
          and (:hasRequester = false or d.requester = :requester)
          and (:hasDateFrom = false or d.requestedAt >= :dateFrom)
          and (:hasDateTo = false or d.requestedAt < :dateTo)
          and (
            d.requester = :currentEmp
            or exists (
              select 1 from ApprovalLine involvedLine
              where involvedLine.document = d
                and (
                  involvedLine.assignedEmp = :currentEmp
                  or involvedLine.actedEmp = :currentEmp
                )
            )
          )
          and (
            :role = 'ALL'
            or (:role = 'REQUESTER' and d.requester = :currentEmp)
            or (:role = 'APPROVER' and exists (
              select 1 from ApprovalLine approverLine
              where approverLine.document = d
                and approverLine.lineType in ('AGREEMENT', 'APPROVAL')
                and (approverLine.assignedEmp = :currentEmp or approverLine.actedEmp = :currentEmp)
            ))
            or (:role = 'RECEIVER' and exists (
              select 1 from ApprovalLine receiverLine
              where receiverLine.document = d
                and receiverLine.lineType = 'RECEIVER'
                and receiverLine.assignedEmp = :currentEmp
            ))
            or (:role = 'SHARED' and exists (
              select 1 from ApprovalLine sharedLine
              where sharedLine.document = d
                and sharedLine.lineType in ('REFERENCE', 'READER')
                and sharedLine.assignedEmp = :currentEmp
            ))
            or (:role = 'DELEGATED' and exists (
              select 1 from ApprovalLine delegatedLine
              where delegatedLine.document = d
                and delegatedLine.actedEmp = :currentEmp
                and delegatedLine.assignedEmp <> :currentEmp
            ))
          )
        order by d.completedAt desc, d.approvalId desc
        """)
    Page<ApprovalDocument> findCompletedInvolved(
        @Param("hasKeyword") boolean hasKeyword,
        @Param("keyword") String keyword,
        @Param("hasTemplateCode") boolean hasTemplateCode,
        @Param("templateCode") String templateCode,
        @Param("hasStatus") boolean hasStatus,
        @Param("status") String status,
        @Param("hasRequester") boolean hasRequester,
        @Param("requester") Emp requester,
        @Param("currentEmp") Emp currentEmp,
        @Param("role") String role,
        @Param("hasDateFrom") boolean hasDateFrom,
        @Param("dateFrom") LocalDateTime dateFrom,
        @Param("hasDateTo") boolean hasDateTo,
        @Param("dateTo") LocalDateTime dateTo,
        Pageable pageable
    );

    @Query("""
        select distinct d from ApprovalDocument d
        join ApprovalLine l on l.document = d
        where d.deletedYn = 'N'
          and l.assignedEmp = :approver
        order by d.approvalId desc
        """)
    Page<ApprovalDocument> findVisibleToApprover(@Param("approver") Emp approver, Pageable pageable);
}
