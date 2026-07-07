package com.kjh.groupware.domain.log;

import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findTop100ByOrderByAuditIdDesc();

    Page<AuditLog> findAllByOrderByAuditIdDesc(Pageable pageable);

    Page<AuditLog> findByTargetTableAndActionTypeInOrderByAuditIdDesc(
        String targetTable,
        Collection<String> actionTypes,
        Pageable pageable
    );

    @Query("""
        select a from AuditLog a
        where lower(a.actionType) like lower(concat('%', :keyword, '%'))
           or lower(a.targetTable) like lower(concat('%', :keyword, '%'))
           or lower(coalesce(a.reason, '')) like lower(concat('%', :keyword, '%'))
           or lower(coalesce(a.ipAddress, '')) like lower(concat('%', :keyword, '%'))
           or lower(coalesce(a.userAgent, '')) like lower(concat('%', :keyword, '%'))
        order by a.auditId desc
        """)
    Page<AuditLog> searchGlobal(@Param("keyword") String keyword, Pageable pageable);
}
