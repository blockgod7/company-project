package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalLineRepository extends JpaRepository<ApprovalLine, Long> {

    List<ApprovalLine> findByDocumentOrderByLineOrderAsc(ApprovalDocument document);

    Optional<ApprovalLine> findByDocumentAndStatus(ApprovalDocument document, String status);

    void deleteByDocument(ApprovalDocument document);

    Page<ApprovalLine> findByApproverAndStatusOrderByLineIdDesc(Emp approver, String status, Pageable pageable);

    Page<ApprovalLine> findByApproverAndStatusInOrderByLineIdDesc(Emp approver, Collection<String> statuses, Pageable pageable);
}
