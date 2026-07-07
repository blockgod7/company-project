package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.log.AuditLog;
import com.kjh.groupware.domain.log.AuditLogRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class AuditLogGlobalSearchProvider implements GlobalSearchProvider {

    private final AuditLogRepository auditLogRepository;

    @Override
    public int order() {
        return 90;
    }

    @Override
    public GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp) {
        if (!"ADMIN".equals(currentEmp.getRoleCode())) {
            return new GlobalSearchGroupResponse("admin", "관리자", 0, List.of());
        }
        Page<AuditLog> page = auditLogRepository.searchGlobal(keyword, PageRequest.of(0, limit));
        List<GlobalSearchItemResponse> items = page.getContent().stream()
            .map(log -> new GlobalSearchItemResponse(
                "AUDIT_LOG",
                log.getAuditId(),
                log.getTargetId(),
                "audit",
                log.getActionType() + " · " + log.getTargetTable(),
                GlobalSearchText.snippet(log.getReason()),
                GlobalSearchText.join(log.getEmpId() == null ? null : "emp #" + log.getEmpId(), log.getIpAddress()),
                List.of("관리자"),
                log.getCreatedAt()
            ))
            .toList();
        return new GlobalSearchGroupResponse("admin", "관리자", page.getTotalElements(), items);
    }
}
