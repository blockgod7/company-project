package com.kjh.groupware.domain.auth;

import com.kjh.groupware.domain.auth.dto.CurrentUserResponse;
import com.kjh.groupware.domain.auth.dto.LoginOptionResponse;
import com.kjh.groupware.domain.auth.dto.LoginRequest;
import com.kjh.groupware.domain.auth.dto.LoginResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
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

    @Value("${app.auth.refresh-cookie.name:refreshToken}")
    private String refreshCookieName;

    @Value("${app.auth.refresh-cookie.path:/api/v1/auth}")
    private String refreshCookiePath;

    @Value("${app.auth.refresh-cookie.secure:false}")
    private boolean refreshCookieSecure;

    @Value("${app.auth.refresh-cookie.same-site:Lax}")
    private String refreshCookieSameSite;

    @Value("${app.jwt.refresh-token-validity-seconds}")
    private long refreshTokenValiditySeconds;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<LoginResponse>> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest httpRequest
    ) {
        AuthService.AuthenticatedLogin login = authService.login(
            request,
            httpRequest.getRemoteAddr(),
            httpRequest.getHeader("User-Agent")
        );
        return withRefreshCookie(login);
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
    public ResponseEntity<ApiResponse<LoginResponse>> refresh(
        @CookieValue(name = "${app.auth.refresh-cookie.name:refreshToken}", required = false) String refreshCookie,
        HttpServletRequest httpRequest
    ) {
        AuthService.AuthenticatedLogin login = authService.refresh(
            refreshCookie,
            httpRequest.getRemoteAddr(),
            httpRequest.getHeader("User-Agent")
        );
        return withRefreshCookie(login);
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse<Void>> logout(
        @CookieValue(name = "${app.auth.refresh-cookie.name:refreshToken}", required = false) String refreshCookie
    ) {
        authService.logout(refreshCookie);
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, expiredRefreshCookie().toString())
            .body(ApiResponse.ok(null, "Logged out"));
    }

    private ResponseEntity<ApiResponse<LoginResponse>> withRefreshCookie(AuthService.AuthenticatedLogin login) {
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, refreshCookie(login.refreshToken()).toString())
            .body(ApiResponse.ok(login.response()));
    }

    private ResponseCookie refreshCookie(String refreshToken) {
        return ResponseCookie.from(refreshCookieName, refreshToken)
            .httpOnly(true)
            .secure(refreshCookieSecure)
            .sameSite(refreshCookieSameSite)
            .path(refreshCookiePath)
            .maxAge(refreshTokenValiditySeconds)
            .build();
    }

    private ResponseCookie expiredRefreshCookie() {
        return ResponseCookie.from(refreshCookieName, "")
            .httpOnly(true)
            .secure(refreshCookieSecure)
            .sameSite(refreshCookieSameSite)
            .path(refreshCookiePath)
            .maxAge(0)
            .build();
    }
}
