package com.kjh.groupware.domain.auth.dto;

import java.util.List;

public record LoginResponse(
    String accessToken,
    String refreshToken,
    String tokenType,
    Long empId,
    String loginId,
    String empName,
    String genderCode,
    String roleCode,
    Long deptId,
    String deptName,
    List<String> permissions,
    boolean mustChangePassword
) {
}
