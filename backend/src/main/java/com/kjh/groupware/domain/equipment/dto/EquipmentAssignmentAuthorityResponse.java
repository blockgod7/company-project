package com.kjh.groupware.domain.equipment.dto;

import com.kjh.groupware.domain.equipment.EquipmentAssignmentAuthority;
import java.time.LocalDateTime;
public record EquipmentAssignmentAuthorityResponse(Long authorityId, Long empId, String empName, String deptName, String grantedByName, LocalDateTime grantedAt) {
    public static EquipmentAssignmentAuthorityResponse from(EquipmentAssignmentAuthority value) {
        return new EquipmentAssignmentAuthorityResponse(value.getAuthorityId(), value.getEmp().getEmpId(), value.getEmp().getEmpName(), value.getEmp().getDept() == null ? null : value.getEmp().getDept().getDeptName(), value.getGrantedBy().getEmpName(), value.getCreatedAt());
    }
}
