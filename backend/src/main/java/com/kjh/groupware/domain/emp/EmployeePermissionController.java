package com.kjh.groupware.domain.emp;

import com.kjh.groupware.domain.emp.dto.EmployeePermissionUpdateRequest;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.validation.Valid;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/employee-management/permissions")
@RequiredArgsConstructor
public class EmployeePermissionController {
    private final EmployeePermissionService permissionService;

    @PutMapping("/{empId}")
    public ApiResponse<List<String>> update(
        @PathVariable Long empId,
        @Valid @RequestBody EmployeePermissionUpdateRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(permissionService.update(
            empId, request.permissionCode(), request.active(), request.reason(),
            httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")
        ));
    }
}
