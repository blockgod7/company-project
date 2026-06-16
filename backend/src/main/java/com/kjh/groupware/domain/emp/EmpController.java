package com.kjh.groupware.domain.emp;

import com.kjh.groupware.domain.emp.dto.EmpResponse;
import com.kjh.groupware.global.response.ApiResponse;
import com.kjh.groupware.global.response.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/emps")
@RequiredArgsConstructor
public class EmpController {

    private final EmpQueryService empQueryService;

    @GetMapping
    public ApiResponse<PageResponse<EmpResponse>> search(
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false) Long deptId,
        @RequestParam(required = false, defaultValue = "ACTIVE") String status,
        @RequestParam(required = false, defaultValue = "0") int page,
        @RequestParam(required = false, defaultValue = "20") int size
    ) {
        return ApiResponse.ok(empQueryService.search(keyword, deptId, status, page, size));
    }
}
