package com.kjh.groupware.domain.auth.dto;

import com.kjh.groupware.domain.emp.Emp;
import java.util.List;

public record CurrentUserResponse(
    Long empId,
    String loginId,
    String empName,
    String roleCode,
    Long deptId,
    String deptName,
    List<String> permissions
) {

    public static CurrentUserResponse from(Emp emp) {
        List<String> permissions = "ADMIN".equals(emp.getRoleCode())
            ? List.of("ADMIN", "NOTICE_WRITE", "BOARD_WRITE", "NOTIFICATION_CREATE", "AUDIT_READ")
            : List.of("NOTICE_READ", "BOARD_READ", "BOARD_WRITE", "ORGANIZATION_READ", "NOTIFICATION_READ");
        return new CurrentUserResponse(
            emp.getEmpId(),
            emp.getLoginId(),
            emp.getEmpName(),
            emp.getRoleCode(),
            emp.getDept() == null ? null : emp.getDept().getDeptId(),
            emp.getDept() == null ? null : emp.getDept().getDeptName(),
            permissions
        );
    }
}
