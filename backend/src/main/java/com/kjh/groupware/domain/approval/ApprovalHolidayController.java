package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalHolidayPermissionResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayImpactResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayOfficialImpactResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayOfficialSyncRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayOfficialSyncResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayProviderStatusResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayOverrideRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalHolidayResponse;
import com.kjh.groupware.domain.approval.dto.LeaveExclusionResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
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
@RequestMapping("${app.api-prefix:/api/v1}/approval-holidays")
@RequiredArgsConstructor
public class ApprovalHolidayController {

    private final ApprovalHolidayService service;

    @GetMapping
    public ApiResponse<List<ApprovalHolidayResponse>> active(
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ApiResponse.ok(service.active(from, to));
    }

    @GetMapping("/manage")
    public ApiResponse<List<ApprovalHolidayResponse>> manageList() {
        return ApiResponse.ok(service.manageList());
    }

    @GetMapping("/permission")
    public ApiResponse<ApprovalHolidayPermissionResponse> permission() {
        return ApiResponse.ok(service.permission());
    }

    @GetMapping("/official/provider-status")
    public ApiResponse<ApprovalHolidayProviderStatusResponse> officialProviderStatus() {
        return ApiResponse.ok(service.officialProviderStatus());
    }

    @GetMapping("/approvals/{approvalId}/exclusions")
    public ApiResponse<List<LeaveExclusionResponse>> exclusions(@PathVariable Long approvalId) {
        return ApiResponse.ok(service.exclusions(approvalId));
    }

    @GetMapping("/{holidayId}/impact")
    public ApiResponse<ApprovalHolidayImpactResponse> impact(@PathVariable Long holidayId) {
        return ApiResponse.ok(service.impact(holidayId));
    }

    @PostMapping("/{holidayId}/activate")
    public ApiResponse<ApprovalHolidayResponse> activate(
        @PathVariable Long holidayId,
        @Valid @RequestBody(required = false) ApprovalHolidayOverrideRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(service.activate(
            holidayId,
            request == null ? null : request.reason(),
            httpRequest.getRemoteAddr(),
            httpRequest.getHeader("User-Agent")
        ));
    }

    @GetMapping("/official/{year}/impact")
    public ApiResponse<ApprovalHolidayOfficialImpactResponse> officialImpact(@PathVariable int year) {
        return ApiResponse.ok(service.previewOfficial(year));
    }

    @PostMapping("/official/{year}/sync")
    public ApiResponse<ApprovalHolidayOfficialSyncResponse> syncOfficial(
        @PathVariable int year,
        @Valid @RequestBody ApprovalHolidayOfficialSyncRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(service.syncOfficial(
            year,
            request,
            httpRequest.getRemoteAddr(),
            httpRequest.getHeader("User-Agent")
        ));
    }

    @PostMapping
    public ApiResponse<ApprovalHolidayResponse> create(
        @Valid @RequestBody ApprovalHolidayRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(service.create(request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PutMapping("/{holidayId}")
    public ApiResponse<ApprovalHolidayResponse> update(
        @PathVariable Long holidayId,
        @Valid @RequestBody ApprovalHolidayRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(service.update(holidayId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @DeleteMapping("/{holidayId}")
    public ApiResponse<ApprovalHolidayResponse> delete(
        @PathVariable Long holidayId,
        @Valid @RequestBody(required = false) ApprovalHolidayOverrideRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(service.delete(
            holidayId,
            request == null ? null : request.reason(),
            httpRequest.getRemoteAddr(),
            httpRequest.getHeader("User-Agent")
        ));
    }
}
