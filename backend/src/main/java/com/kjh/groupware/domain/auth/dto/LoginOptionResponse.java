package com.kjh.groupware.domain.auth.dto;

import com.kjh.groupware.domain.emp.Emp;

public record LoginOptionResponse(
    String loginId,
    String empName,
    String deptName,
    String positionName,
    String roleCode
) {

    public static LoginOptionResponse from(Emp emp) {
        return new LoginOptionResponse(
            emp.getLoginId(),
            emp.getEmpName(),
            emp.getDept() == null ? null : emp.getDept().getDeptName(),
            emp.getPositionName(),
            emp.getRoleCode()
        );
    }
}
