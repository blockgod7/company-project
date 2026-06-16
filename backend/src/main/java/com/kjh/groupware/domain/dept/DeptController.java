package com.kjh.groupware.domain.dept;

import com.kjh.groupware.domain.dept.dto.DeptTreeResponse;
import com.kjh.groupware.global.response.ApiResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/depts")
@RequiredArgsConstructor
public class DeptController {

    private final DeptService deptService;

    @GetMapping("/tree")
    public ApiResponse<List<DeptTreeResponse>> findTree() {
        return ApiResponse.ok(deptService.findTree());
    }
}
