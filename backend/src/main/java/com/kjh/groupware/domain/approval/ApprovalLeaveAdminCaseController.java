package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.*;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("${app.api-prefix:/api/v1}/leave-admin-cases") @RequiredArgsConstructor
public class ApprovalLeaveAdminCaseController {
    private final ApprovalLeaveAdminCaseService service;
    @GetMapping("/{approvalId}") public ApiResponse<LeaveAdminCaseResponse> get(@PathVariable Long approvalId) { return ApiResponse.ok(service.get(approvalId)); }
    @PutMapping("/{approvalId}/sick-pay") public ApiResponse<LeaveAdminCaseResponse> sick(@PathVariable Long approvalId, @Valid @RequestBody LeaveAdminReasonRequest request, HttpServletRequest http) { return ApiResponse.ok(service.sickPay(approvalId, request, http.getRemoteAddr(), http.getHeader("User-Agent"))); }
    @PutMapping("/{approvalId}/workers-comp") public ApiResponse<LeaveAdminCaseResponse> comp(@PathVariable Long approvalId, @Valid @RequestBody LeaveAdminReasonRequest request, HttpServletRequest http) { return ApiResponse.ok(service.workersComp(approvalId, request, http.getRemoteAddr(), http.getHeader("User-Agent"))); }
}
