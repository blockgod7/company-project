package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.EquipmentProposalRequest;
import com.kjh.groupware.domain.approval.dto.EquipmentProposalResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/approvals/{approvalId}/equipment-proposal")
@RequiredArgsConstructor
public class ApprovalEquipmentProposalController {

    private final ApprovalEquipmentProposalService equipmentProposalService;

    @GetMapping
    public ApiResponse<EquipmentProposalResponse> find(@PathVariable Long approvalId) {
        return ApiResponse.ok(equipmentProposalService.find(approvalId));
    }

    @PatchMapping
    public ApiResponse<EquipmentProposalResponse> update(
        @PathVariable Long approvalId,
        @Valid @RequestBody EquipmentProposalRequest request
    ) {
        return ApiResponse.ok(equipmentProposalService.update(approvalId, request));
    }

    @PostMapping("/assign-pe")
    public ApiResponse<EquipmentProposalResponse> assignPe(
        @PathVariable Long approvalId,
        @Valid @RequestBody EquipmentProposalRequest request
    ) {
        return ApiResponse.ok(equipmentProposalService.assignPe(approvalId, request));
    }

    @PostMapping("/submit-pe")
    public ApiResponse<EquipmentProposalResponse> submitPe(
        @PathVariable Long approvalId,
        @Valid @RequestBody EquipmentProposalRequest request
    ) {
        return ApiResponse.ok(equipmentProposalService.submitPe(approvalId, request));
    }

    @PostMapping("/assign-purchase")
    public ApiResponse<EquipmentProposalResponse> assignPurchase(
        @PathVariable Long approvalId,
        @Valid @RequestBody EquipmentProposalRequest request
    ) {
        return ApiResponse.ok(equipmentProposalService.assignPurchase(approvalId, request));
    }

    @PostMapping("/submit-purchase")
    public ApiResponse<EquipmentProposalResponse> submitPurchase(
        @PathVariable Long approvalId,
        @Valid @RequestBody EquipmentProposalRequest request
    ) {
        return ApiResponse.ok(equipmentProposalService.submitPurchase(approvalId, request));
    }
}
