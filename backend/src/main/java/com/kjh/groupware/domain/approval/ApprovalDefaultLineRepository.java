package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalDefaultLineRepository extends JpaRepository<ApprovalDefaultLine, Long> {

    List<ApprovalDefaultLine> findByOwnerAndDefaultTypeAndActiveYnAndDeletedYnOrderBySortOrderAscDefaultLineIdDesc(
        Emp owner,
        String defaultType,
        String activeYn,
        String deletedYn
    );

    List<ApprovalDefaultLine> findByOwnerAndDefaultTypeAndDeletedYnOrderBySortOrderAscDefaultLineIdDesc(
        Emp owner,
        String defaultType,
        String deletedYn
    );

    List<ApprovalDefaultLine> findByOwnerAndDefaultTypeAndLineNameAndDeletedYnOrderBySortOrderAscDefaultLineIdDesc(
        Emp owner,
        String defaultType,
        String lineName,
        String deletedYn
    );

    List<ApprovalDefaultLine> findByDefaultTypeAndTemplateCodeAndActiveYnAndDeletedYnOrderBySortOrderAscDefaultLineIdDesc(
        String defaultType,
        String templateCode,
        String activeYn,
        String deletedYn
    );
}
