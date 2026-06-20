package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalOperationSettingRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalOperationSettingResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/approval-operation-settings")
@RequiredArgsConstructor
public class ApprovalOperationSettingController {

    private final ApprovalOperationSettingService settingService;

    @GetMapping
    public ApiResponse<ApprovalOperationSettingResponse> current() {
        return ApiResponse.ok(settingService.currentForAdmin());
    }

    @PutMapping
    public ApiResponse<ApprovalOperationSettingResponse> update(
        @Valid @RequestBody ApprovalOperationSettingRequest request
    ) {
        return ApiResponse.ok(settingService.update(request));
    }
}
