package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.LeavePolicyOverride;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record LeavePolicyOverrideResponse(
    Long policyOverrideId,
    Long empId,
    String empName,
    String leaveType,
    LocalDate referenceDate,
    BigDecimal baseMaxDays,
    BigDecimal overrideMaxDays,
    Integer baseMaxSegments,
    Integer overrideMaxSegments,
    String reason,
    String grantedByName,
    boolean active,
    LocalDateTime createdAt,
    LocalDateTime revokedAt,
    String revokeReason
) {
    public static LeavePolicyOverrideResponse from(LeavePolicyOverride value) {
        return new LeavePolicyOverrideResponse(
            value.getPolicyOverrideId(), value.getEmp().getEmpId(), value.getEmp().getEmpName(), value.getLeaveType(),
            value.getReferenceDate(), value.getBaseMaxDays(), value.getOverrideMaxDays(), value.getBaseMaxSegments(),
            value.getOverrideMaxSegments(), value.getReason(), value.getGrantedBy().getEmpName(), value.isActive(),
            value.getCreatedAt(), value.getRevokedAt(), value.getRevokeReason()
        );
    }
}
