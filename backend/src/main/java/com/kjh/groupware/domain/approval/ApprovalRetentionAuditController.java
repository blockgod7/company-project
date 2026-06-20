package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.log.dto.AuditLogResponse;
import com.kjh.groupware.global.response.ApiResponse;
import com.kjh.groupware.global.response.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/approvals/retention-audits")
@RequiredArgsConstructor
public class ApprovalRetentionAuditController {

    private final ApprovalRetentionAuditService retentionAuditService;

    @GetMapping
    public ApiResponse<PageResponse<AuditLogResponse>> findPage(
        @RequestParam(required = false, defaultValue = "0") int page,
        @RequestParam(required = false, defaultValue = "100") int size
    ) {
        return ApiResponse.ok(retentionAuditService.findPage(page, size));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportCsv() {
        return ResponseEntity.ok()
            .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("approval-retention-audits.csv").build().toString())
            .body(retentionAuditService.csv());
    }
}
