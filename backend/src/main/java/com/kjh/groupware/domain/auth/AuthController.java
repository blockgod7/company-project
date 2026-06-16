package com.kjh.groupware.domain.auth;

import com.kjh.groupware.domain.auth.dto.LoginRequest;
import com.kjh.groupware.domain.auth.dto.LoginResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(authService.login(
            request,
            httpRequest.getRemoteAddr(),
            httpRequest.getHeader("User-Agent")
        ));
    }
}
