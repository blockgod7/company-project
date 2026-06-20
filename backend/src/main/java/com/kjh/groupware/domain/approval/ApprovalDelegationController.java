package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalDelegationRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalDelegationResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/approval-delegations")
@RequiredArgsConstructor
public class ApprovalDelegationController {

    private final ApprovalDelegationService delegationService;

    @GetMapping("/me")
    public ApiResponse<ApprovalDelegationResponse> getMine() {
        return ApiResponse.ok(delegationService.getMine());
    }

    @PutMapping("/me")
    public ApiResponse<ApprovalDelegationResponse> saveMine(
        @RequestBody ApprovalDelegationRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(delegationService.saveMine(request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @DeleteMapping("/me")
    public ApiResponse<Void> deleteMine(HttpServletRequest httpRequest) {
        delegationService.deleteMine(httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ApiResponse.ok(null, "Deleted");
    }
}
