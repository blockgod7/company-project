package com.kjh.groupware.domain.auth;

import com.kjh.groupware.domain.auth.dto.CurrentUserResponse;
import com.kjh.groupware.domain.auth.dto.LoginOptionResponse;
import com.kjh.groupware.domain.auth.dto.LoginRequest;
import com.kjh.groupware.domain.auth.dto.LoginResponse;
import com.kjh.groupware.domain.auth.dto.PasswordChangeRequest;
import com.kjh.groupware.domain.auth.dto.MyProfileResponse;
import com.kjh.groupware.domain.auth.dto.MyProfileUpdateRequest;
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
import org.springframework.web.bind.annotation.PutMapping;
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

    @Value("${app.auth.login-options-enabled:false}")
    private boolean loginOptionsEnabled;

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
        return ApiResponse.ok(loginOptionsEnabled ? authService.loginOptions() : List.of());
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

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<Void>> changePassword(@Valid @RequestBody PasswordChangeRequest request) {
        authService.changePassword(request.currentPassword(), request.newPassword());
        return ResponseEntity.ok()
            .header(HttpHeaders.SET_COOKIE, expiredRefreshCookie().toString())
            .body(ApiResponse.ok(null, "비밀번호가 변경되었습니다. 다시 로그인해 주세요."));
    }

    @GetMapping("/profile")
    public ApiResponse<MyProfileResponse> myProfile() {
        return ApiResponse.ok(authService.myProfile());
    }

    @PutMapping("/profile")
    public ApiResponse<MyProfileResponse> updateMyProfile(@Valid @RequestBody MyProfileUpdateRequest request) {
        return ApiResponse.ok(authService.updateMyProfile(request));
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
