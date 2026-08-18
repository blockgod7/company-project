package com.kjh.groupware.domain.emp.dto;

import com.kjh.groupware.domain.emp.Emp;

public record EmployeeDirectoryResponse(
    Long empId,
    String empNo,
    String empName,
    String email,
    String phone,
    String extensionNumber,
    Long deptId,
    String deptName,
    String positionName,
    String jobTitle,
    String status
) {
    public static EmployeeDirectoryResponse from(Emp emp) {
        return new EmployeeDirectoryResponse(
            emp.getEmpId(), emp.getEmpNo(), emp.getEmpName(), emp.getEmail(), emp.getPhone(), emp.getExtensionNumber(),
            emp.getDept() == null ? null : emp.getDept().getDeptId(),
            emp.getDept() == null ? null : emp.getDept().getDeptName(),
            emp.getPositionName(), emp.getJobTitle(), emp.getStatus()
        );
    }
}
