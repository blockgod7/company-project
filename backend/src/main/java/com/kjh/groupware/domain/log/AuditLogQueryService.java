package com.kjh.groupware.domain.log;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.log.dto.AuditLogResponse;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuditLogQueryService {

    private final AuditLogRepository auditLogRepository;
    private final CurrentEmpProvider currentEmpProvider;

    @Transactional(readOnly = true)
    public List<AuditLogResponse> findRecent() {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        if (!"ADMIN".equals(currentEmp.getRoleCode())) {
            throw BusinessException.forbidden("ADMIN_REQUIRED", "Admin role is required");
        }
        return auditLogRepository.findTop100ByOrderByAuditIdDesc().stream()
            .map(AuditLogResponse::from)
            .toList();
    }
}
