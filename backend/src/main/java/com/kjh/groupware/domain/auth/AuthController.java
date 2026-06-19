package com.kjh.groupware.domain.auth;

import com.kjh.groupware.domain.auth.dto.CurrentUserResponse;
import com.kjh.groupware.domain.auth.dto.LoginOptionResponse;
import com.kjh.groupware.domain.auth.dto.LoginRequest;
import com.kjh.groupware.domain.auth.dto.LoginResponse;
import com.kjh.groupware.domain.auth.dto.RefreshTokenRequest;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
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

    @GetMapping("/login-options")
    public ApiResponse<List<LoginOptionResponse>> loginOptions() {
        return ApiResponse.ok(authService.loginOptions());
    }

    @GetMapping("/me")
    public ApiResponse<CurrentUserResponse> me() {
        return ApiResponse.ok(authService.me());
    }

    @PostMapping("/refresh")
    public ApiResponse<LoginResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return ApiResponse.ok(authService.refresh(request));
    }
}
