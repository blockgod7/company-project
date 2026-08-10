package com.kjh.groupware.domain.emp;

import com.kjh.groupware.domain.emp.dto.EmployeeAccountIssueRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeCreateRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeLeaveRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeManagementResponse;
import com.kjh.groupware.domain.emp.dto.EmployeeRehireRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeRetireRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeUpdateRequest;
import com.kjh.groupware.domain.emp.dto.TemporaryPasswordResponse;
import com.kjh.groupware.global.response.ApiResponse;
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
@RequestMapping("${app.api-prefix:/api/v1}/employee-management")
@RequiredArgsConstructor
public class EmployeeManagementController {
    private final EmployeeManagementService service;

    @GetMapping public ApiResponse<List<EmployeeManagementResponse>> findAll() { return ApiResponse.ok(service.findAll()); }
    @GetMapping("/{empId}") public ApiResponse<EmployeeManagementResponse> findOne(@PathVariable Long empId) { return ApiResponse.ok(service.findOne(empId)); }
    @GetMapping("/{empId}/retire-impact") public ApiResponse<com.kjh.groupware.domain.emp.dto.EmployeeLeaveImpactResponse> retireImpact(@PathVariable Long empId, @RequestParam LocalDate retireDate) { return ApiResponse.ok(service.retirementImpact(empId, retireDate)); }
    @GetMapping("/{empId}/leave-impact") public ApiResponse<com.kjh.groupware.domain.emp.dto.EmployeeLeaveImpactResponse> leaveImpact(@PathVariable Long empId, @RequestParam LocalDate startDate, @RequestParam LocalDate endDate) { return ApiResponse.ok(service.leaveImpact(empId, startDate, endDate)); }
    @PostMapping public ApiResponse<EmployeeManagementResponse> create(@Valid @RequestBody EmployeeCreateRequest request) { return ApiResponse.ok(service.create(request)); }
    @PutMapping("/{empId}") public ApiResponse<EmployeeManagementResponse> update(@PathVariable Long empId, @Valid @RequestBody EmployeeUpdateRequest request) { return ApiResponse.ok(service.update(empId, request)); }
    @PostMapping("/{empId}/retire") public ApiResponse<EmployeeManagementResponse> retire(@PathVariable Long empId, @Valid @RequestBody EmployeeRetireRequest request) { return ApiResponse.ok(service.retire(empId, request)); }
    @PostMapping("/{empId}/leave") public ApiResponse<EmployeeManagementResponse> leave(@PathVariable Long empId, @Valid @RequestBody EmployeeLeaveRequest request) { return ApiResponse.ok(service.startLeave(empId, request)); }
    @PostMapping("/{empId}/return") public ApiResponse<EmployeeManagementResponse> returnFromLeave(@PathVariable Long empId) { return ApiResponse.ok(service.returnFromLeave(empId)); }
    @PostMapping("/{empId}/rehire") public ApiResponse<EmployeeManagementResponse> rehire(@PathVariable Long empId, @Valid @RequestBody EmployeeRehireRequest request) { return ApiResponse.ok(service.rehire(empId, request)); }
    @PostMapping("/{empId}/account") public ApiResponse<TemporaryPasswordResponse> issueAccount(@PathVariable Long empId, @Valid @RequestBody EmployeeAccountIssueRequest request) { return ApiResponse.ok(service.issueAccount(empId, request)); }
    @PostMapping("/{empId}/account/reset-password") public ApiResponse<TemporaryPasswordResponse> resetPassword(@PathVariable Long empId) { return ApiResponse.ok(service.resetPassword(empId)); }
    @PostMapping("/{empId}/account/unlock") public ApiResponse<EmployeeManagementResponse> unlock(@PathVariable Long empId) { return ApiResponse.ok(service.unlock(empId)); }
}
