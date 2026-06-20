package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
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

    Page<ApprovalLine> findByAssignedEmpAndLineTypeInAndStatusInOrderByLineIdDesc(
        Emp assignedEmp,
        Collection<String> lineTypes,
        Collection<String> statuses,
        Pageable pageable
    );

    Page<ApprovalLine> findByAssignedEmpAndStatusInOrderByLineIdDesc(Emp assignedEmp, Collection<String> statuses, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select l from ApprovalLine l join fetch l.document where l.lineId = :lineId")
    Optional<ApprovalLine> findByIdForUpdate(@Param("lineId") Long lineId);
}
