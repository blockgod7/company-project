package com.kjh.groupware.domain.emp.dto;

import java.time.LocalDateTime;

public record TemporaryPasswordResponse(Long empId, String loginId, String temporaryPassword, LocalDateTime expiresAt) {}
