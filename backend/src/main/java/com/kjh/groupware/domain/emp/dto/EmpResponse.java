package com.kjh.groupware.domain.emp.dto;

import com.kjh.groupware.domain.emp.Emp;

public record EmpResponse(
    Long empId,
    String empNo,
    String loginId,
    String empName,
    String email,
    String phone,
    Long deptId,
    String deptName,
    String positionName,
    String jobTitle,
    String roleCode,
    String status
) {

    public static EmpResponse from(Emp emp) {
        return new EmpResponse(
            emp.getEmpId(),
            emp.getEmpNo(),
            emp.getLoginId(),
            emp.getEmpName(),
            emp.getEmail(),
            emp.getPhone(),
            emp.getDept() == null ? null : emp.getDept().getDeptId(),
            emp.getDept() == null ? null : emp.getDept().getDeptName(),
            emp.getPositionName(),
            emp.getJobTitle(),
            emp.getRoleCode(),
            emp.getStatus()
        );
    }
}
