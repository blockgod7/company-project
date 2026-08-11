package com.kjh.groupware.domain.emp.dto;

import com.kjh.groupware.domain.emp.Emp;
import java.time.LocalDate;
import java.util.List;

public record EmployeeManagementResponse(
    Long empId,
    String empNo,
    String loginId,
    String empName,
    String genderCode,
    String email,
    String phone,
    Long deptId,
    String deptName,
    String positionName,
    String jobTitle,
    Long managerEmpId,
    String managerName,
    String roleCode,
    LocalDate hireDate,
    LocalDate retireDate,
    LocalDate rehireDate,
    LocalDate employmentStartDate,
    String employmentType,
    String workCategory,
    LocalDate contractStartDate,
    LocalDate contractEndDate,
    String status,
    String accountStatus,
    boolean rehired,
    List<String> permissions
) {
    public static EmployeeManagementResponse from(Emp emp, List<String> permissions) {
        return new EmployeeManagementResponse(
            emp.getEmpId(), emp.getEmpNo(), emp.getLoginId(), emp.getEmpName(), emp.getGenderCode(),
            emp.getEmail(), emp.getPhone(), emp.getDept() == null ? null : emp.getDept().getDeptId(),
            emp.getDept() == null ? null : emp.getDept().getDeptName(), emp.getPositionName(), emp.getJobTitle(),
            emp.getManager() == null ? null : emp.getManager().getEmpId(), emp.getManager() == null ? null : emp.getManager().getEmpName(),
            emp.getRoleCode(), emp.getHireDate(), emp.getRetireDate(), emp.getRehireDate(), emp.currentEmploymentStartDate(),
            emp.getEmploymentType(), emp.getWorkCategory(), emp.getContractStartDate(), emp.getContractEndDate(), emp.getStatus(), emp.getAccountStatus(),
            emp.isRehired(), permissions
        );
    }
}
