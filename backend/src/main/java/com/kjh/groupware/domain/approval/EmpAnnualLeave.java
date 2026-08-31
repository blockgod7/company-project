package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.*;

@Entity
@Table(name = "emp_annual_leave", uniqueConstraints = @UniqueConstraint(columnNames = {"emp_id", "leave_year"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmpAnnualLeave {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long annualLeaveId;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "emp_id", nullable = false) private Emp emp;
    @Column(name = "leave_year", nullable = false) private int leaveYear;
    @Column(name = "granted_days", nullable = false) private BigDecimal grantedDays;
    @Column(name = "adjustment_days", nullable = false) private BigDecimal adjustmentDays;
    @Column(name = "adjustment_reason") private String adjustmentReason;
    @Column(name = "manual_used_days", nullable = false) private BigDecimal manualUsedDays;
    @Column(name = "auto_calculated_days", nullable = false) private BigDecimal autoCalculatedDays;
    @Column(name = "final_days", nullable = false) private BigDecimal finalDays;
    @Column(name = "calculation_mode", nullable = false, length = 20) private String calculationMode;
    @Column(name = "confirmation_status", nullable = false, length = 30) private String confirmationStatus;
    @Column(name = "calculation_basis", length = 1000) private String calculationBasis;
    @Column(name = "confirmed_at") private LocalDateTime confirmedAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "confirmed_by") private Emp confirmedBy;
    @Column(name = "reset_at", nullable = false) private LocalDateTime resetAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "updated_by") private Emp updatedBy;

    public EmpAnnualLeave(Emp emp, int year, BigDecimal grantedDays) {
        this.emp = emp; this.leaveYear = year; this.grantedDays = grantedDays;
        this.adjustmentDays = BigDecimal.ZERO; this.manualUsedDays = BigDecimal.ZERO;
        this.autoCalculatedDays = grantedDays; this.finalDays = grantedDays;
        this.calculationMode = "AUTO"; this.confirmationStatus = "CONFIRMED";
        this.resetAt = LocalDateTime.now();
    }

    public void recalculate(BigDecimal calculatedDays, String basis, String confirmationStatus) {
        this.grantedDays = calculatedDays;
        this.adjustmentDays = BigDecimal.ZERO;
        this.autoCalculatedDays = calculatedDays;
        this.finalDays = calculatedDays;
        this.calculationMode = "AUTO";
        this.confirmationStatus = confirmationStatus;
        this.calculationBasis = basis;
        this.adjustmentReason = null;
        this.confirmedAt = "CONFIRMED".equals(confirmationStatus) ? LocalDateTime.now() : null;
        this.confirmedBy = null;
        this.resetAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public void finalizeDays(BigDecimal days, String reason, Emp editor) {
        this.adjustmentDays = days.subtract(autoCalculatedDays);
        this.finalDays = days;
        this.calculationMode = "MANUAL";
        this.confirmationStatus = "CONFIRMED";
        this.adjustmentReason = reason;
        this.confirmedBy = editor;
        this.confirmedAt = LocalDateTime.now();
        this.updatedBy = editor;
        this.updatedAt = LocalDateTime.now();
    }

    public boolean isManual() {
        return "MANUAL".equals(calculationMode);
    }
}
