package com.kjh.groupware.domain.equipment;

import com.kjh.groupware.domain.equipment.dto.EquipmentAssignmentRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentAssignmentAuthorityRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentAssignmentAuthorityResponse;
import com.kjh.groupware.domain.equipment.dto.EquipmentAssignmentPermissionResponse;
import com.kjh.groupware.domain.equipment.dto.EquipmentCompletionRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentHistoryResponse;
import com.kjh.groupware.domain.equipment.dto.EquipmentReportRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentReportResponse;
import com.kjh.groupware.domain.equipment.dto.EquipmentRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentResponse;
import com.kjh.groupware.domain.equipment.dto.EquipmentProcessRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentProcessResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/equipment")
@RequiredArgsConstructor
public class EquipmentManagementController {
    private final EquipmentManagementService service;
    @GetMapping public ApiResponse<List<EquipmentResponse>> equipments() { return ApiResponse.ok(service.equipments()); }
    @PostMapping public ApiResponse<EquipmentResponse> create(@Valid @RequestBody EquipmentRequest request) { return ApiResponse.ok(service.createEquipment(request)); }
    @PutMapping("/{equipmentId}") public ApiResponse<EquipmentResponse> update(@PathVariable Long equipmentId, @Valid @RequestBody EquipmentRequest request) { return ApiResponse.ok(service.updateEquipment(equipmentId, request)); }
    @GetMapping("/processes") public ApiResponse<List<EquipmentProcessResponse>> processes() { return ApiResponse.ok(service.processes()); }
    @PostMapping("/processes") public ApiResponse<EquipmentProcessResponse> createProcess(@Valid @RequestBody EquipmentProcessRequest request) { return ApiResponse.ok(service.createProcess(request)); }
    @GetMapping("/reports") public ApiResponse<List<EquipmentReportResponse>> reports() { return ApiResponse.ok(service.reports()); }
    @GetMapping("/reports/{reportId}") public ApiResponse<EquipmentReportResponse> reportDetail(@PathVariable Long reportId) { return ApiResponse.ok(service.reportDetail(reportId)); }
    @GetMapping("/assignment-permission") public ApiResponse<EquipmentAssignmentPermissionResponse> assignmentPermission() { return ApiResponse.ok(service.assignmentPermission()); }
    @GetMapping("/assignment-authorities") public ApiResponse<List<EquipmentAssignmentAuthorityResponse>> assignmentAuthorities() { return ApiResponse.ok(service.assignmentAuthorities()); }
    @PostMapping("/assignment-authorities") public ApiResponse<EquipmentAssignmentAuthorityResponse> grantAssignmentAuthority(@Valid @RequestBody EquipmentAssignmentAuthorityRequest request) { return ApiResponse.ok(service.grantAssignmentAuthority(request)); }
    @DeleteMapping("/assignment-authorities/{authorityId}") public ApiResponse<Void> revokeAssignmentAuthority(@PathVariable Long authorityId) { service.revokeAssignmentAuthority(authorityId); return ApiResponse.ok(null); }
    @GetMapping("/{equipmentId}/history") public ApiResponse<List<EquipmentHistoryResponse>> history(@PathVariable Long equipmentId) { return ApiResponse.ok(service.history(equipmentId)); }
    @PostMapping("/reports") public ApiResponse<EquipmentReportResponse> report(@Valid @RequestBody EquipmentReportRequest request, HttpServletRequest http) { return ApiResponse.ok(service.createReport(request, http.getRemoteAddr(), http.getHeader("User-Agent"))); }
    @PostMapping("/reports/{reportId}/assign") public ApiResponse<EquipmentReportResponse> assign(@PathVariable Long reportId, @Valid @RequestBody EquipmentAssignmentRequest request) { return ApiResponse.ok(service.assign(reportId, request)); }
    @PostMapping("/reports/{reportId}/complete") public ApiResponse<EquipmentReportResponse> complete(@PathVariable Long reportId, @Valid @RequestBody EquipmentCompletionRequest request, HttpServletRequest http) { return ApiResponse.ok(service.submitCompletion(reportId, request, http.getRemoteAddr(), http.getHeader("User-Agent"))); }
}
