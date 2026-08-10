package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.LeavePolicy;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record LeavePolicyResponse(
    Long leavePolicyId,
    String leaveType,
    String displayName,
    boolean active,
    String payType,
    BigDecimal annualDeductionDays,
    String unitType,
    BigDecimal maxDays,
    Integer periodBeforeDays,
    Integer periodAfterDays,
    String genderRestriction,
    boolean evidenceRequired,
    Integer maxSegments,
    boolean adminOverrideAllowed,
    LocalDate effectiveFrom,
    LocalDate effectiveTo,
    String changeReason,
    Long updatedByEmpId,
    String updatedByName,
    LocalDateTime updatedAt
) {
    public static LeavePolicyResponse from(LeavePolicy policy) {
        return new LeavePolicyResponse(
            policy.getLeavePolicyId(), policy.getLeaveType(), policy.getDisplayName(), policy.isActive(),
            policy.getPayType(), policy.getAnnualDeductionDays(), policy.getUnitType(), policy.getMaxDays(),
            policy.getPeriodBeforeDays(), policy.getPeriodAfterDays(), policy.getGenderRestriction(),
            policy.isEvidenceRequired(), policy.getMaxSegments(), policy.isAdminOverrideAllowed(),
            policy.getEffectiveFrom(), policy.getEffectiveTo(), policy.getChangeReason(),
            policy.getUpdatedBy() == null ? null : policy.getUpdatedBy().getEmpId(),
            policy.getUpdatedBy() == null ? null : policy.getUpdatedBy().getEmpName(),
            policy.getUpdatedAt()
        );
    }
}
