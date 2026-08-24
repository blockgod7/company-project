package com.kjh.groupware.domain.work;

import com.kjh.groupware.domain.approval.ApprovalDocument;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkRequestChangeRepository extends JpaRepository<WorkRequestChange, Long> {
    List<WorkRequestChange> findByApprovalOrderByWorkChangeIdAsc(ApprovalDocument approval);
    void deleteByApproval(ApprovalDocument approval);
}
