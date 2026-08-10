package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.LeavePolicyOverrideRequest;
import com.kjh.groupware.domain.approval.dto.LeavePolicyOverrideResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/leave-policy-overrides")
@RequiredArgsConstructor
public class LeavePolicyOverrideController {
    private final LeavePolicyOverrideService service;

    @GetMapping("/spouse-birth")
    public ApiResponse<List<LeavePolicyOverrideResponse>> list(@RequestParam Long empId) {
        return ApiResponse.ok(service.list(empId));
    }

    @PostMapping("/spouse-birth")
    public ApiResponse<LeavePolicyOverrideResponse> grant(
        @Valid @RequestBody LeavePolicyOverrideRequest request,
        HttpServletRequest http
    ) {
        return ApiResponse.ok(service.grant(request, http.getRemoteAddr(), http.getHeader("User-Agent")));
    }

    @DeleteMapping("/{overrideId}")
    public ApiResponse<LeavePolicyOverrideResponse> revoke(
        @PathVariable Long overrideId,
        @RequestBody Map<String, String> request,
        HttpServletRequest http
    ) {
        return ApiResponse.ok(service.revoke(overrideId, request.get("reason"), http.getRemoteAddr(), http.getHeader("User-Agent")));
    }
}
