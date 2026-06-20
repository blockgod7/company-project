package com.kjh.groupware.domain.log;

import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findTop100ByOrderByAuditIdDesc();

    Page<AuditLog> findAllByOrderByAuditIdDesc(Pageable pageable);

    Page<AuditLog> findByTargetTableAndActionTypeInOrderByAuditIdDesc(
        String targetTable,
        Collection<String> actionTypes,
        Pageable pageable
    );
}
