package com.kjh.groupware.domain.emp;

import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/emps")
@RequiredArgsConstructor
public class EmpSignatureController {

    private final EmpSignatureService signatureService;

    @PostMapping("/{empId}/signature")
    public ApiResponse<Long> upload(
        @PathVariable Long empId,
        @RequestParam MultipartFile file,
        HttpServletRequest request
    ) {
        return ApiResponse.ok(signatureService.upload(empId, file, request).getSignatureId());
    }
}
