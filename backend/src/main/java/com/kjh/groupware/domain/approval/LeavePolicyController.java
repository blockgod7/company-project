package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.LeavePolicyRequest;
import com.kjh.groupware.domain.approval.dto.LeavePolicyResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/leave-policies")
@RequiredArgsConstructor
public class LeavePolicyController {

    private final LeavePolicyService service;

    @GetMapping
    public ApiResponse<List<LeavePolicyResponse>> activeList(@RequestParam(required = false) LocalDate date) {
        return ApiResponse.ok(service.activeList(date));
    }

    @GetMapping("/manage")
    public ApiResponse<List<LeavePolicyResponse>> manageList() {
        return ApiResponse.ok(service.manageList());
    }

    @PostMapping
    public ApiResponse<LeavePolicyResponse> create(
        @Valid @RequestBody LeavePolicyRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(service.create(request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PutMapping("/{policyId}")
    public ApiResponse<LeavePolicyResponse> update(
        @PathVariable Long policyId,
        @Valid @RequestBody LeavePolicyRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(service.update(policyId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }
}
