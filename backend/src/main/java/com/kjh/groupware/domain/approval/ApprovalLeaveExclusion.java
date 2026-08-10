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
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "approval_leave_exclusion")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalLeaveExclusion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "exclusion_id")
    private Long exclusionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "approval_id", nullable = false)
    private ApprovalDocument document;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "holiday_id", nullable = false)
    private ApprovalHoliday holiday;

    @Column(name = "leave_date", nullable = false)
    private LocalDate leaveDate;

    @Column(name = "leave_type", nullable = false, length = 50)
    private String leaveType;

    @Column(name = "restored_days", nullable = false)
    private BigDecimal restoredDays;

    @Column(name = "reason", nullable = false, length = 300)
    private String reason;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Emp createdBy;

    @Column(name = "active_yn", nullable = false, length = 1)
    private String activeYn;

    @Column(name = "reversed_at")
    private LocalDateTime reversedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reversed_by")
    private Emp reversedBy;

    @Column(name = "reversal_reason", length = 300)
    private String reversalReason;

    public ApprovalLeaveExclusion(
        ApprovalDocument document,
        ApprovalHoliday holiday,
        LocalDate leaveDate,
        String leaveType,
        BigDecimal restoredDays,
        String reason,
        Emp creator
    ) {
        this.document = document;
        this.holiday = holiday;
        this.leaveDate = leaveDate;
        this.leaveType = leaveType;
        this.restoredDays = restoredDays;
        this.reason = reason;
        this.createdBy = creator;
        this.activeYn = "Y";
    }

    public boolean isActive() { return "Y".equals(activeYn); }

    public void reverse(Emp editor, String reason) {
        this.activeYn = "N";
        this.reversedAt = LocalDateTime.now();
        this.reversedBy = editor;
        this.reversalReason = reason;
    }

    public void reactivate(Emp editor, String reason) {
        this.activeYn = "Y";
        this.reason = reason;
        this.reversedAt = null;
        this.reversedBy = null;
        this.reversalReason = null;
        this.createdBy = editor;
    }
}
