package com.kjh.groupware.domain.auth.dto;

public record LoginResponse(
    String accessToken,
    String tokenType,
    Long empId,
    String loginId,
    String empName,
    String roleCode
) {
}
