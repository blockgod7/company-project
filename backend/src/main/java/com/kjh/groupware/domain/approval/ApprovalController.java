package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalActionRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalBoxResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalDashboardResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalSummaryResponse;
import com.kjh.groupware.domain.approval.dto.LeaveUsageResponse;
import com.kjh.groupware.domain.file.AttachFile;
import com.kjh.groupware.domain.file.FileService;
import com.kjh.groupware.global.response.ApiResponse;
import com.kjh.groupware.global.response.PageResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/approvals")
@RequiredArgsConstructor
public class ApprovalController {

    private final ApprovalService approvalService;
    private final ApprovalDraftService approvalDraftService;
    private final ApprovalWorkflowService approvalWorkflowService;
    private final ApprovalQueryService approvalQueryService;
    private final ApprovalPdfService pdfService;
    private final FileService fileService;
    private final ApprovalLeaveUsageService leaveUsageService;

    @GetMapping("/boxes")
    public ApiResponse<java.util.List<ApprovalBoxResponse>> boxes() {
        return ApiResponse.ok(approvalQueryService.boxes());
    }

    @GetMapping("/dashboard")
    public ApiResponse<ApprovalDashboardResponse> dashboard() {
        return ApiResponse.ok(approvalQueryService.dashboard());
    }

    @GetMapping("/deleted")
    public ApiResponse<PageResponse<ApprovalSummaryResponse>> deletedPage(
        @RequestParam(required = false, defaultValue = "0") int page,
        @RequestParam(required = false, defaultValue = "20") int size
    ) {
        return ApiResponse.ok(approvalQueryService.deletedPage(page, size));
    }

    @GetMapping("/leave-usage/me")
    public ApiResponse<LeaveUsageResponse> myLeaveUsage() {
        return ApiResponse.ok(leaveUsageService.myUsage());
    }

    @GetMapping
    public ApiResponse<PageResponse<ApprovalSummaryResponse>> findPage(
        @RequestParam(required = false, defaultValue = "pending") String box,
        @RequestParam(required = false, defaultValue = "0") int page,
        @RequestParam(required = false, defaultValue = "20") int size,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) String templateCode,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) Long requesterEmpId,
        @RequestParam(required = false) LocalDate dateFrom,
        @RequestParam(required = false) LocalDate dateTo,
        @RequestParam(required = false) String dashboardFilter
    ) {
        return ApiResponse.ok(approvalQueryService.findPage(box, page, size, keyword, templateCode, status, requesterEmpId, dateFrom, dateTo, dashboardFilter));
    }

    @PostMapping
    public ApiResponse<ApprovalResponse> create(
        @Valid @RequestBody ApprovalRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalDraftService.create(request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/drafts")
    public ApiResponse<ApprovalResponse> createDraft(
        @Valid @RequestBody ApprovalRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalDraftService.createDraft(request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @GetMapping("/{approvalId}")
    public ApiResponse<ApprovalResponse> findOne(@PathVariable Long approvalId, HttpServletRequest httpRequest) {
        return ApiResponse.ok(approvalQueryService.findOne(approvalId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PutMapping("/{approvalId}/draft")
    public ApiResponse<ApprovalResponse> updateDraft(
        @PathVariable Long approvalId,
        @Valid @RequestBody ApprovalRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalDraftService.updateDraft(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/submit")
    public ApiResponse<ApprovalResponse> submit(
        @PathVariable Long approvalId,
        @Valid @RequestBody ApprovalRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalDraftService.submit(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/withdraw")
    public ApiResponse<ApprovalResponse> withdraw(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalWorkflowService.withdraw(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/cancel")
    public ApiResponse<ApprovalResponse> cancel(
        @PathVariable Long approvalId,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalWorkflowService.cancel(approvalId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/redraft")
    public ApiResponse<ApprovalResponse> redraft(
        @PathVariable Long approvalId,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalWorkflowService.redraft(approvalId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/approve")
    public ApiResponse<ApprovalResponse> approve(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalWorkflowService.approve(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/actions/{action}")
    public ApiResponse<ApprovalResponse> act(
        @PathVariable Long approvalId,
        @PathVariable String action,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalWorkflowService.act(approvalId, action, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/reject")
    public ApiResponse<ApprovalResponse> reject(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalWorkflowService.reject(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/receive")
    public ApiResponse<ApprovalResponse> receive(
        @PathVariable Long approvalId,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalWorkflowService.receive(approvalId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/complete-receipt")
    public ApiResponse<ApprovalResponse> completeReceipt(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalWorkflowService.completeReceipt(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @GetMapping("/{approvalId}/pdf")
    public ResponseEntity<Resource> downloadPdf(@PathVariable Long approvalId, HttpServletRequest httpRequest) {
        AttachFile file = pdfService.getGeneratedPdf(approvalId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        Resource resource = fileService.loadResource(file);
        String encodedName = URLEncoder.encode(file.getOriginalFileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
            .contentType(fileService.mediaType(file))
            .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0")
            .header(HttpHeaders.PRAGMA, "no-cache")
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(encodedName).build().toString())
            .body(resource);
    }

    @PostMapping("/{approvalId}/pdf/regenerate")
    public ApiResponse<ApprovalResponse> regeneratePdf(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request
    ) {
        return ApiResponse.ok(approvalWorkflowService.regeneratePdf(approvalId, request));
    }

    @DeleteMapping("/{approvalId}")
    public ApiResponse<Void> deleteForRetention(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        approvalService.deleteForRetention(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ApiResponse.ok(null);
    }

    @PostMapping("/{approvalId}/restore")
    public ApiResponse<ApprovalResponse> restore(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.restore(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/status-correction")
    public ApiResponse<ApprovalResponse> correctStatus(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalWorkflowService.correctStatus(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }
}
