package com.kjh.groupware.global.audit;

import com.fasterxml.jackson.databind.JsonNode;
import com.kjh.groupware.domain.log.AuditLog;
import com.kjh.groupware.domain.log.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(
        Long empId,
        AuditActionType actionType,
        String targetTable,
        Long targetId,
        String ipAddress,
        String userAgent
    ) {
        record(empId, actionType, targetTable, targetId, null, null, ipAddress, userAgent);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(
        Long empId,
        AuditActionType actionType,
        String targetTable,
        Long targetId,
        JsonNode beforeJson,
        JsonNode afterJson,
        String ipAddress,
        String userAgent
    ) {
        AuditLog auditLog = AuditLog.builder()
            .empId(empId)
            .actionType(actionType.name())
            .targetTable(targetTable)
            .targetId(targetId)
            .beforeJson(beforeJson)
            .afterJson(afterJson)
            .ipAddress(ipAddress)
            .userAgent(userAgent)
            .build();

        auditLogRepository.save(auditLog);
    }
}
