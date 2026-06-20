package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalActionRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalSummaryResponse;
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
    private final ApprovalPdfService pdfService;
    private final FileService fileService;

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
        @RequestParam(required = false) LocalDate dateTo
    ) {
        return ApiResponse.ok(approvalService.findPage(box, page, size, keyword, templateCode, status, requesterEmpId, dateFrom, dateTo));
    }

    @PostMapping
    public ApiResponse<ApprovalResponse> create(
        @Valid @RequestBody ApprovalRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.create(request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/drafts")
    public ApiResponse<ApprovalResponse> createDraft(
        @Valid @RequestBody ApprovalRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.createDraft(request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @GetMapping("/{approvalId}")
    public ApiResponse<ApprovalResponse> findOne(@PathVariable Long approvalId, HttpServletRequest httpRequest) {
        return ApiResponse.ok(approvalService.findOne(approvalId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PutMapping("/{approvalId}/draft")
    public ApiResponse<ApprovalResponse> updateDraft(
        @PathVariable Long approvalId,
        @Valid @RequestBody ApprovalRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.updateDraft(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/submit")
    public ApiResponse<ApprovalResponse> submit(
        @PathVariable Long approvalId,
        @Valid @RequestBody ApprovalRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.submit(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/withdraw")
    public ApiResponse<ApprovalResponse> withdraw(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.withdraw(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/cancel")
    public ApiResponse<ApprovalResponse> cancel(
        @PathVariable Long approvalId,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.cancel(approvalId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/redraft")
    public ApiResponse<ApprovalResponse> redraft(
        @PathVariable Long approvalId,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.redraft(approvalId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
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

    @PostMapping("/{approvalId}/receive")
    public ApiResponse<ApprovalResponse> receive(
        @PathVariable Long approvalId,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.receive(approvalId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/{approvalId}/complete-receipt")
    public ApiResponse<ApprovalResponse> completeReceipt(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(approvalService.completeReceipt(approvalId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @GetMapping("/{approvalId}/pdf")
    public ResponseEntity<Resource> downloadPdf(@PathVariable Long approvalId, HttpServletRequest httpRequest) {
        AttachFile file = pdfService.getGeneratedPdf(approvalId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        Resource resource = fileService.loadResource(file);
        String encodedName = URLEncoder.encode(file.getOriginalFileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
            .contentType(fileService.mediaType(file))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(encodedName).build().toString())
            .body(resource);
    }

    @PostMapping("/{approvalId}/pdf/regenerate")
    public ApiResponse<ApprovalResponse> regeneratePdf(
        @PathVariable Long approvalId,
        @RequestBody(required = false) ApprovalActionRequest request
    ) {
        return ApiResponse.ok(approvalService.regeneratePdf(approvalId, request));
    }
}
