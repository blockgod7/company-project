package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
    name = "leave_policy",
    uniqueConstraints = @UniqueConstraint(name = "uq_leave_policy_type_from", columnNames = {"leave_type", "effective_from"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LeavePolicy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "leave_policy_id")
    private Long leavePolicyId;

    @Column(name = "leave_type", nullable = false, length = 50)
    private String leaveType;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(name = "active_yn", nullable = false, length = 1)
    private String activeYn;

    @Column(name = "pay_type", nullable = false, length = 20)
    private String payType;

    @Column(name = "annual_deduction_days", nullable = false, precision = 5, scale = 1)
    private BigDecimal annualDeductionDays;

    @Column(name = "unit_type", nullable = false, length = 20)
    private String unitType;

    @Column(name = "max_days", precision = 5, scale = 1)
    private BigDecimal maxDays;

    @Column(name = "period_before_days")
    private Integer periodBeforeDays;

    @Column(name = "period_after_days")
    private Integer periodAfterDays;

    @Column(name = "gender_restriction", nullable = false, length = 10)
    private String genderRestriction;

    @Column(name = "evidence_required_yn", nullable = false, length = 1)
    private String evidenceRequiredYn;

    @Column(name = "max_segments")
    private Integer maxSegments;

    @Column(name = "admin_override_allowed_yn", nullable = false, length = 1)
    private String adminOverrideAllowedYn;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Column(name = "change_reason", nullable = false, length = 500)
    private String changeReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Emp createdBy;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "updated_by")
    private Emp updatedBy;

    public LeavePolicy(
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
        Emp editor
    ) {
        apply(
            leaveType, displayName, active, payType, annualDeductionDays, unitType, maxDays,
            periodBeforeDays, periodAfterDays, genderRestriction, evidenceRequired, maxSegments,
            adminOverrideAllowed, effectiveFrom, effectiveTo, changeReason
        );
        this.createdAt = LocalDateTime.now();
        this.createdBy = editor;
    }

    public void update(
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
        Emp editor
    ) {
        apply(
            leaveType, displayName, active, payType, annualDeductionDays, unitType, maxDays,
            periodBeforeDays, periodAfterDays, genderRestriction, evidenceRequired, maxSegments,
            adminOverrideAllowed, effectiveFrom, effectiveTo, changeReason
        );
        this.updatedAt = LocalDateTime.now();
        this.updatedBy = editor;
    }

    public boolean isActive() {
        return "Y".equals(activeYn);
    }

    public boolean isEvidenceRequired() {
        return "Y".equals(evidenceRequiredYn);
    }

    public boolean isAdminOverrideAllowed() {
        return "Y".equals(adminOverrideAllowedYn);
    }

    private void apply(
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
        String changeReason
    ) {
        this.leaveType = leaveType;
        this.displayName = displayName;
        this.activeYn = active ? "Y" : "N";
        this.payType = payType;
        this.annualDeductionDays = annualDeductionDays;
        this.unitType = unitType;
        this.maxDays = maxDays;
        this.periodBeforeDays = periodBeforeDays;
        this.periodAfterDays = periodAfterDays;
        this.genderRestriction = genderRestriction;
        this.evidenceRequiredYn = evidenceRequired ? "Y" : "N";
        this.maxSegments = maxSegments;
        this.adminOverrideAllowedYn = adminOverrideAllowed ? "Y" : "N";
        this.effectiveFrom = effectiveFrom;
        this.effectiveTo = effectiveTo;
        this.changeReason = changeReason;
    }
}
