package com.kjh.groupware.domain.log;

import com.kjh.groupware.domain.log.dto.AuditLogResponse;
import com.kjh.groupware.global.response.ApiResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/audit-logs")
@RequiredArgsConstructor
public class AuditLogController {

    private final AuditLogQueryService auditLogQueryService;

    @GetMapping
    public ApiResponse<List<AuditLogResponse>> findRecent() {
        return ApiResponse.ok(auditLogQueryService.findRecent());
    }
}
