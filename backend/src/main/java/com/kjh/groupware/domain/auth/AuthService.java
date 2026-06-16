package com.kjh.groupware.domain.auth;

import com.kjh.groupware.domain.auth.dto.CurrentUserResponse;
import com.kjh.groupware.domain.auth.dto.LoginRequest;
import com.kjh.groupware.domain.auth.dto.LoginResponse;
import com.kjh.groupware.domain.auth.dto.RefreshTokenRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import com.kjh.groupware.global.security.JwtTokenProvider;
import io.jsonwebtoken.Claims;
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

    @Transactional
    public LoginResponse login(LoginRequest request, String ipAddress, String userAgent) {
        Emp emp = empRepository.findByLoginId(request.loginId())
            .orElseThrow(() -> BusinessException.unauthorized("LOGIN_FAILED", "Invalid login id or password"));

        if (!emp.isActiveUser()) {
            auditLogService.record(emp.getEmpId(), AuditActionType.LOGIN_FAIL, "emp", emp.getEmpId(), ipAddress, userAgent);
            throw BusinessException.forbidden("INACTIVE_ACCOUNT", "Inactive employee account");
        }
        if (emp.isAccountLocked()) {
            auditLogService.record(emp.getEmpId(), AuditActionType.LOGIN_FAIL, "emp", emp.getEmpId(), ipAddress, userAgent);
            throw BusinessException.forbidden("ACCOUNT_LOCKED", "Employee account is locked");
        }
        if (!passwordEncoder.matches(request.password(), emp.getPasswordHash())) {
            emp.recordLoginFailure();
            auditLogService.record(emp.getEmpId(), AuditActionType.LOGIN_FAIL, "emp", emp.getEmpId(), ipAddress, userAgent);
            throw BusinessException.unauthorized("LOGIN_FAILED", "Invalid login id or password");
        }

        emp.recordLoginSuccess();
        String accessToken = jwtTokenProvider.createAccessToken(emp.getEmpId(), emp.getLoginId(), emp.getRoleCode());
        String refreshToken = jwtTokenProvider.createRefreshToken(emp.getEmpId(), emp.getLoginId(), emp.getRoleCode());
        auditLogService.record(emp.getEmpId(), AuditActionType.LOGIN, "emp", emp.getEmpId(), ipAddress, userAgent);

        return new LoginResponse(accessToken, refreshToken, "Bearer", emp.getEmpId(), emp.getLoginId(), emp.getEmpName(), emp.getRoleCode());
    }

    @Transactional(readOnly = true)
    public CurrentUserResponse me() {
        return CurrentUserResponse.from(currentEmpProvider.getCurrentEmp());
    }

    @Transactional(readOnly = true)
    public LoginResponse refresh(RefreshTokenRequest request) {
        Claims claims = jwtTokenProvider.validateRefreshToken(request.refreshToken())
            .orElseThrow(() -> BusinessException.unauthorized("INVALID_REFRESH_TOKEN", "Refresh token is invalid"));
        Emp emp = empRepository.findActiveByLoginId(claims.getSubject())
            .orElseThrow(() -> BusinessException.unauthorized("UNAUTHORIZED", "Authenticated employee was not found"));
        String accessToken = jwtTokenProvider.createAccessToken(emp.getEmpId(), emp.getLoginId(), emp.getRoleCode());
        String refreshToken = jwtTokenProvider.createRefreshToken(emp.getEmpId(), emp.getLoginId(), emp.getRoleCode());
        return new LoginResponse(accessToken, refreshToken, "Bearer", emp.getEmpId(), emp.getLoginId(), emp.getEmpName(), emp.getRoleCode());
    }
}
