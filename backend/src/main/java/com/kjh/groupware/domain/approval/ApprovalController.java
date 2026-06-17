package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalActionRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalSummaryResponse;
import com.kjh.groupware.global.response.ApiResponse;
import com.kjh.groupware.global.response.PageResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final ApprovalService approvalService;

    @GetMapping
    public ApiResponse<PageResponse<ApprovalSummaryResponse>> findPage(
        @RequestParam(required = false, defaultValue = "pending") String box,
        @RequestParam(required = false, defaultValue = "0") int page,
        @RequestParam(required = false, defaultValue = "20") int size
    ) {
        return ApiResponse.ok(approvalService.findPage(box, page, size));
    }

    @PostMapping
    public ApiResponse<ApprovalResponse> create(
        @Valid @RequestBody ApprovalRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.create(request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @GetMapping("/{approvalId}")
    public ApiResponse<ApprovalResponse> findOne(@PathVariable Long approvalId) {
        return ApiResponse.ok(approvalService.findOne(approvalId));
    }

    @PostMapping("/{approvalId}/approve")
    public ApiResponse<ApprovalResponse> approve(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.approve(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/reject")
    public ApiResponse<ApprovalResponse> reject(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.reject(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }
}
