package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.log.AuditLogRepository;
import com.kjh.groupware.domain.log.dto.AuditLogResponse;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.response.PageResponse;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.nio.charset.StandardCharsets;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalRetentionAuditService {

    private final AuditLogRepository auditLogRepository;
    private final ApprovalPermissionService permissionService;
    private final CurrentEmpProvider currentEmpProvider;

    @Transactional(readOnly = true)
    public PageResponse<AuditLogResponse> findPage(int page, int size) {
        requireOperationAdmin();
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        return PageResponse.from(retentionAudits(pageRequest).map(AuditLogResponse::from));
    }

    @Transactional(readOnly = true)
    public byte[] csv() {
        requireOperationAdmin();
        StringBuilder csv = new StringBuilder();
        csv.append('\ufeff');
        csv.append("auditId,actionType,targetId,empId,reason,success,ipAddress,createdAt\n");
        retentionAudits(PageRequest.of(0, 10000)).stream()
            .map(AuditLogResponse::from)
            .forEach(item -> csv.append(item.auditId()).append(',')
                .append(escape(item.actionType())).append(',')
                .append(item.targetId() == null ? "" : item.targetId()).append(',')
                .append(item.empId() == null ? "" : item.empId()).append(',')
                .append(escape(item.reason())).append(',')
                .append(item.success() ? "Y" : "N").append(',')
                .append(escape(item.ipAddress())).append(',')
                .append(item.createdAt()).append('\n'));
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }

    private org.springframework.data.domain.Page<com.kjh.groupware.domain.log.AuditLog> retentionAudits(Pageable pageable) {
        return auditLogRepository.findByTargetTableAndActionTypeInOrderByAuditIdDesc(
            "approval_document",
            List.of(AuditActionType.DELETE_APPROVAL.name(), AuditActionType.RESTORE_APPROVAL.name()),
            pageable
        );
    }

    private void requireOperationAdmin() {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        if (!permissionService.canManageOperations(currentEmp)) {
            throw BusinessException.forbidden("APPROVAL_RETENTION_AUDIT_FORBIDDEN", "전자결재 관리자만 보존삭제 감사 리포트를 조회할 수 있습니다.");
        }
    }

    private String escape(String value) {
        if (value == null) {
            return "";
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
