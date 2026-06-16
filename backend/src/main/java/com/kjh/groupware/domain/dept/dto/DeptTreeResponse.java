package com.kjh.groupware.domain.dept.dto;

import com.kjh.groupware.domain.dept.Dept;
import java.util.ArrayList;
import java.util.List;

public record DeptTreeResponse(
    Long deptId,
    String deptCode,
    String deptName,
    Long parentDeptId,
    List<DeptTreeResponse> children
) {

    public static DeptTreeResponse from(Dept dept, List<DeptTreeResponse> children) {
        return new DeptTreeResponse(
            dept.getDeptId(),
            dept.getDeptCode(),
            dept.getDeptName(),
            dept.getParentDept() == null ? null : dept.getParentDept().getDeptId(),
            children
        );
    }

    public static DeptTreeResponse mutable(Dept dept) {
        return from(dept, new ArrayList<>());
    }
}
