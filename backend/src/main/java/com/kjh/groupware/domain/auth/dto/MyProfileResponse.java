package com.kjh.groupware.domain.auth.dto;

import com.kjh.groupware.domain.emp.Emp;

public record MyProfileResponse(
    String loginId, String empNo, String empName, String deptName,
    String positionName, String jobTitle, String email, String phone, String extensionNumber
) {
    public static MyProfileResponse from(Emp emp) {
        return new MyProfileResponse(emp.getLoginId(), emp.getEmpNo(), emp.getEmpName(),
            emp.getDept() == null ? null : emp.getDept().getDeptName(),
            emp.getPositionName(), emp.getJobTitle(), emp.getEmail(), emp.getPhone(), emp.getExtensionNumber());
    }
}
