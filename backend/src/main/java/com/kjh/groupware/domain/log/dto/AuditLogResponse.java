package com.kjh.groupware.domain.log.dto;

import com.kjh.groupware.domain.log.AuditLog;
import java.time.LocalDateTime;

public record AuditLogResponse(
    Long auditId,
    Long empId,
    String actionType,
    String targetTable,
    Long targetId,
    String ipAddress,
    String userAgent,
    LocalDateTime createdAt
) {

    public static AuditLogResponse from(AuditLog auditLog) {
        return new AuditLogResponse(
            auditLog.getAuditId(),
            auditLog.getEmpId(),
            auditLog.getActionType(),
            auditLog.getTargetTable(),
            auditLog.getTargetId(),
            auditLog.getIpAddress(),
            auditLog.getUserAgent(),
            auditLog.getCreatedAt()
        );
    }
}
