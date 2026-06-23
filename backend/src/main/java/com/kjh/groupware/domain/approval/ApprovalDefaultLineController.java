package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalDefaultLineRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalDefaultLineResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/approval-default-lines")
@RequiredArgsConstructor
public class ApprovalDefaultLineController {

    private final ApprovalDefaultLineService defaultLineService;

    @GetMapping("/effective")
    public ApiResponse<ApprovalDefaultLineResponse> effective(
        @RequestParam(required = false) String templateCode
    ) {
        return ApiResponse.ok(defaultLineService.effective(templateCode));
    }

    @PutMapping("/me")
    public ApiResponse<ApprovalDefaultLineResponse> savePersonal(
        @Valid @RequestBody ApprovalDefaultLineRequest request
    ) {
        return ApiResponse.ok(defaultLineService.savePersonal(request));
    }

    @GetMapping("/me")
    public ApiResponse<List<ApprovalDefaultLineResponse>> listPersonal() {
        return ApiResponse.ok(defaultLineService.listPersonal());
    }

    @PatchMapping("/me/{defaultLineId}")
    public ApiResponse<ApprovalDefaultLineResponse> renamePersonal(
        @PathVariable Long defaultLineId,
        @Valid @RequestBody ApprovalDefaultLineRequest request
    ) {
        return ApiResponse.ok(defaultLineService.renamePersonal(defaultLineId, request));
    }

    @DeleteMapping("/me/{defaultLineId}")
    public ApiResponse<Void> deletePersonal(@PathVariable Long defaultLineId) {
        defaultLineService.deletePersonal(defaultLineId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/templates/{templateCode}")
    public ApiResponse<ApprovalDefaultLineResponse> template(
        @PathVariable String templateCode
    ) {
        return ApiResponse.ok(defaultLineService.template(templateCode));
    }

    @PutMapping("/templates/{templateCode}")
    public ApiResponse<ApprovalDefaultLineResponse> saveTemplate(
        @PathVariable String templateCode,
        @Valid @RequestBody ApprovalDefaultLineRequest request
    ) {
        return ApiResponse.ok(defaultLineService.saveTemplate(templateCode, request));
    }
}
