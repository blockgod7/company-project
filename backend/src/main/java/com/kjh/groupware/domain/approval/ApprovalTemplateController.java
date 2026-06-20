package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalTemplateRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalTemplateResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/approval-templates")
@RequiredArgsConstructor
public class ApprovalTemplateController {

    private final ApprovalTemplateService templateService;

    @GetMapping
    public ApiResponse<List<ApprovalTemplateResponse>> findLatestActive() {
        return ApiResponse.ok(templateService.latestActive());
    }

    @GetMapping("/admin")
    public ApiResponse<List<ApprovalTemplateResponse>> findLatestForAdmin() {
        return ApiResponse.ok(templateService.latestForAdmin());
    }

    @GetMapping("/manage")
    public ApiResponse<List<ApprovalTemplateResponse>> findLatestForManagement() {
        return ApiResponse.ok(templateService.latestForAdmin());
    }

    @PostMapping
    public ApiResponse<ApprovalTemplateResponse> saveNewVersion(
        @Valid @RequestBody ApprovalTemplateRequest request
    ) {
        return ApiResponse.ok(templateService.saveNewVersion(request));
    }

    @PatchMapping("/{templateCode}/active")
    public ApiResponse<ApprovalTemplateResponse> setActive(
        @PathVariable String templateCode,
        @RequestParam boolean active
    ) {
        return ApiResponse.ok(templateService.setActive(templateCode, active));
    }

    @PatchMapping("/{templateCode}/status")
    public ApiResponse<ApprovalTemplateResponse> setStatus(
        @PathVariable String templateCode,
        @RequestParam boolean active
    ) {
        return ApiResponse.ok(templateService.setActive(templateCode, active));
    }
}
