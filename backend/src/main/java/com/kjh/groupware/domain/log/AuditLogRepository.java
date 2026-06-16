package com.kjh.groupware.domain.log;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findTop100ByOrderByAuditIdDesc();
}
