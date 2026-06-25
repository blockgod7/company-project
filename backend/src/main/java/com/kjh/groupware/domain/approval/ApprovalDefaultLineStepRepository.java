package com.kjh.groupware.domain.approval;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalDefaultLineStepRepository extends JpaRepository<ApprovalDefaultLineStep, Long> {

    List<ApprovalDefaultLineStep> findByDefaultLineAndDeletedYnOrderByStepOrderAscDefaultLineStepIdAsc(
        ApprovalDefaultLine defaultLine,
        String deletedYn
    );

    void deleteByDefaultLine(ApprovalDefaultLine defaultLine);
}
