package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "leave_policy_override")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class LeavePolicyOverride extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "policy_override_id")
    private Long policyOverrideId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @Column(name = "leave_type", nullable = false, length = 50)
    private String leaveType;

    @Column(name = "reference_date", nullable = false)
    private LocalDate referenceDate;

    @Column(name = "base_max_days", precision = 5, scale = 1)
    private BigDecimal baseMaxDays;

    @Column(name = "override_max_days", precision = 5, scale = 1)
    private BigDecimal overrideMaxDays;

    @Column(name = "base_max_segments")
    private Integer baseMaxSegments;

    @Column(name = "override_max_segments")
    private Integer overrideMaxSegments;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "granted_by", nullable = false)
    private Emp grantedBy;

    @Column(name = "active_yn", nullable = false, length = 1)
    private String activeYn;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revoked_by")
    private Emp revokedBy;

    @Column(name = "revoke_reason", length = 500)
    private String revokeReason;

    public LeavePolicyOverride(
        Emp emp,
        String leaveType,
        LocalDate referenceDate,
        BigDecimal baseMaxDays,
        BigDecimal overrideMaxDays,
        Integer baseMaxSegments,
        Integer overrideMaxSegments,
        String reason,
        Emp grantedBy
    ) {
        this.emp = emp;
        this.leaveType = leaveType;
        this.referenceDate = referenceDate;
        this.baseMaxDays = baseMaxDays;
        this.overrideMaxDays = overrideMaxDays;
        this.baseMaxSegments = baseMaxSegments;
        this.overrideMaxSegments = overrideMaxSegments;
        this.reason = reason;
        this.grantedBy = grantedBy;
        this.activeYn = "Y";
    }

    public boolean isActive() {
        return "Y".equals(activeYn);
    }

    public void revoke(Emp actor, String reason) {
        activeYn = "N";
        revokedAt = LocalDateTime.now();
        revokedBy = actor;
        revokeReason = reason;
    }
}
