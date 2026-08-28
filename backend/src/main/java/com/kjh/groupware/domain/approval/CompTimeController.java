package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.CompTimeCreditResponse;
import com.kjh.groupware.domain.approval.dto.CompTimeExpiryRequest;
import com.kjh.groupware.domain.approval.dto.CompTimeSummaryResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/comp-time")
@RequiredArgsConstructor
public class CompTimeController {
    private final CompTimeLedgerService service;

    @GetMapping("/me")
    public ApiResponse<CompTimeSummaryResponse> mine() {
        return ApiResponse.ok(service.mine());
    }

    @GetMapping("/manage")
    public ApiResponse<CompTimeSummaryResponse> manage(@RequestParam Long empId) {
        return ApiResponse.ok(service.manage(empId));
    }

    @PutMapping("/credits/{creditId}/expiry")
    public ApiResponse<CompTimeCreditResponse> extend(
        @PathVariable Long creditId,
        @Valid @RequestBody CompTimeExpiryRequest request,
        HttpServletRequest http
    ) {
        return ApiResponse.ok(service.extend(creditId, request, http.getRemoteAddr(), http.getHeader("User-Agent")));
    }
}
