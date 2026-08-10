package com.kjh.groupware.domain.auth.dto;

import com.kjh.groupware.domain.emp.Emp;
import java.util.List;

public record CurrentUserResponse(
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

    public static CurrentUserResponse from(Emp emp, List<String> permissions) {
        return new CurrentUserResponse(
            emp.getEmpId(),
            emp.getLoginId(),
            emp.getEmpName(),
            emp.getGenderCode(),
            emp.getRoleCode(),
            emp.getDept() == null ? null : emp.getDept().getDeptId(),
            emp.getDept() == null ? null : emp.getDept().getDeptName(),
            permissions,
            "Y".equals(emp.getMustChangePasswordYn())
        );
    }
}
