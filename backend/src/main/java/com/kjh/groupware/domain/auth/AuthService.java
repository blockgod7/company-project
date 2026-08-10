package com.kjh.groupware.domain.auth;

import com.kjh.groupware.domain.auth.dto.CurrentUserResponse;
import com.kjh.groupware.domain.auth.dto.LoginOptionResponse;
import com.kjh.groupware.domain.auth.dto.LoginRequest;
import com.kjh.groupware.domain.auth.dto.LoginResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import com.kjh.groupware.global.security.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.HexFormat;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final EmpRepository empRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuditLogService auditLogService;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuthRefreshTokenRepository refreshTokenRepository;
    private final LoginRateLimiter loginRateLimiter;
    private final EmployeePermissionService employeePermissionService;

    @Transactional
    public AuthenticatedLogin login(LoginRequest request, String ipAddress, String userAgent) {
        loginRateLimiter.assertAllowed(request.loginId(), ipAddress);
        Emp emp = empRepository.findByLoginId(request.loginId())
            .orElseThrow(() -> {
                loginRateLimiter.recordFailure(request.loginId(), ipAddress);
                return BusinessException.unauthorized("LOGIN_FAILED", "Invalid login id or password");
            });

        if (!emp.isActiveUser()) {
            loginRateLimiter.recordFailure(request.loginId(), ipAddress);
            auditLogService.record(emp.getEmpId(), AuditActionType.LOGIN_FAIL, "emp", emp.getEmpId(), ipAddress, userAgent);
            throw BusinessException.forbidden("INACTIVE_ACCOUNT", "Inactive employee account");
        }
        if (emp.isAccountLocked()) {
            loginRateLimiter.recordFailure(request.loginId(), ipAddress);
            auditLogService.record(emp.getEmpId(), AuditActionType.LOGIN_FAIL, "emp", emp.getEmpId(), ipAddress, userAgent);
            throw BusinessException.forbidden("ACCOUNT_LOCKED", "Employee account is locked");
        }
        if (emp.isTemporaryPasswordExpired(LocalDateTime.now())) {
            throw BusinessException.forbidden("TEMP_PASSWORD_EXPIRED", "임시 비밀번호가 만료되었습니다. 계정관리자에게 재발급을 요청해 주세요.");
        }
        if (!passwordEncoder.matches(request.password(), emp.getPasswordHash())) {
            loginRateLimiter.recordFailure(request.loginId(), ipAddress);
            emp.recordLoginFailure();
            auditLogService.record(emp.getEmpId(), AuditActionType.LOGIN_FAIL, "emp", emp.getEmpId(), ipAddress, userAgent);
            throw BusinessException.unauthorized("LOGIN_FAILED", "Invalid login id or password");
        }

        loginRateLimiter.clear(request.loginId(), ipAddress);
        emp.recordLoginSuccess();
        String accessToken = jwtTokenProvider.createAccessToken(emp.getEmpId(), emp.getLoginId(), emp.getRoleCode());
        String refreshToken = jwtTokenProvider.createRefreshToken(emp.getEmpId(), emp.getLoginId(), emp.getRoleCode());
        saveRefreshToken(emp, refreshToken, ipAddress, userAgent);
        auditLogService.record(emp.getEmpId(), AuditActionType.LOGIN, "emp", emp.getEmpId(), ipAddress, userAgent);

        return new AuthenticatedLogin(
            loginResponse(emp, accessToken),
            refreshToken
        );
    }

    @Transactional(readOnly = true)
    public List<LoginOptionResponse> loginOptions() {
        return empRepository.findActiveLoginOptions().stream()
            .map(LoginOptionResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public CurrentUserResponse me() {
        Emp emp = currentEmpProvider.getCurrentEmp();
        return CurrentUserResponse.from(emp, employeePermissionService.permissionsFor(emp));
    }

    @Transactional
    public AuthenticatedLogin refresh(String refreshToken, String ipAddress, String userAgent) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw BusinessException.unauthorized("INVALID_REFRESH_TOKEN", "Refresh token is invalid");
        }
        Claims claims = jwtTokenProvider.validateRefreshToken(refreshToken)
            .orElseThrow(() -> BusinessException.unauthorized("INVALID_REFRESH_TOKEN", "Refresh token is invalid"));
        AuthRefreshToken savedToken = refreshTokenRepository.findByTokenHash(tokenHash(refreshToken))
            .orElseThrow(() -> BusinessException.unauthorized("INVALID_REFRESH_TOKEN", "Refresh token is invalid"));
        if (!savedToken.isUsable(LocalDateTime.now())) {
            throw BusinessException.unauthorized("INVALID_REFRESH_TOKEN", "Refresh token is invalid");
        }
        Emp emp = empRepository.findActiveByLoginId(claims.getSubject())
            .orElseThrow(() -> BusinessException.unauthorized("UNAUTHORIZED", "Authenticated employee was not found"));
        savedToken.revoke();
        String accessToken = jwtTokenProvider.createAccessToken(emp.getEmpId(), emp.getLoginId(), emp.getRoleCode());
        String newRefreshToken = jwtTokenProvider.createRefreshToken(emp.getEmpId(), emp.getLoginId(), emp.getRoleCode());
        saveRefreshToken(emp, newRefreshToken, ipAddress, userAgent);
        return new AuthenticatedLogin(
            loginResponse(emp, accessToken),
            newRefreshToken
        );
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        refreshTokenRepository.findByTokenHash(tokenHash(refreshToken))
            .ifPresent(AuthRefreshToken::revoke);
    }

    @Transactional
    public void changePassword(String newPassword) {
        Emp emp = currentEmpProvider.getCurrentEmp();
        emp.changePassword(passwordEncoder.encode(newPassword));
        refreshTokenRepository.deleteByEmp(emp);
    }

    private void saveRefreshToken(Emp emp, String refreshToken, String ipAddress, String userAgent) {
        Claims claims = jwtTokenProvider.validateRefreshToken(refreshToken)
            .orElseThrow(() -> BusinessException.unauthorized("INVALID_REFRESH_TOKEN", "Refresh token is invalid"));
        LocalDateTime expiresAt = LocalDateTime.ofInstant(claims.getExpiration().toInstant(), ZoneId.systemDefault());
        refreshTokenRepository.save(new AuthRefreshToken(emp, tokenHash(refreshToken), expiresAt, ipAddress, userAgent));
    }

    private LoginResponse loginResponse(Emp emp, String accessToken) {
        return new LoginResponse(
            accessToken,
            null,
            "Bearer",
            emp.getEmpId(),
            emp.getLoginId(),
            emp.getEmpName(),
            emp.getGenderCode(),
            emp.getRoleCode(),
            emp.getDept() == null ? null : emp.getDept().getDeptId(),
            emp.getDept() == null ? null : emp.getDept().getDeptName(),
            employeePermissionService.permissionsFor(emp),
            "Y".equals(emp.getMustChangePasswordYn())
        );
    }

    private String tokenHash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw BusinessException.badRequest("TOKEN_HASH_FAILED", "Token hash failed");
        }
    }

    public record AuthenticatedLogin(LoginResponse response, String refreshToken) {
    }
}
