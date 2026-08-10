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
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "annual_leave_ledger")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AnnualLeaveLedger {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "annual_leave_ledger_id") private Long annualLeaveLedgerId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "annual_leave_id") private EmpAnnualLeave annualLeave;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "emp_id") private Emp emp;
    @Column(name = "leave_year", nullable = false) private int leaveYear;
    @Column(name = "transaction_type", nullable = false, length = 40) private String transactionType;
    @Column(name = "before_days", nullable = false) private BigDecimal beforeDays;
    @Column(name = "change_days", nullable = false) private BigDecimal changeDays;
    @Column(name = "after_days", nullable = false) private BigDecimal afterDays;
    @Column(name = "reason", nullable = false, length = 500) private String reason;
    @Column(name = "source_type", length = 50) private String sourceType;
    @Column(name = "source_id") private Long sourceId;
    @Column(name = "created_at", nullable = false) private LocalDateTime createdAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by") private Emp createdBy;

    public AnnualLeaveLedger(EmpAnnualLeave annualLeave, String transactionType, BigDecimal beforeDays,
                             BigDecimal afterDays, String reason, String sourceType, Long sourceId, Emp actor) {
        this.annualLeave = annualLeave;
        this.emp = annualLeave.getEmp();
        this.leaveYear = annualLeave.getLeaveYear();
        this.transactionType = transactionType;
        this.beforeDays = beforeDays;
        this.changeDays = afterDays.subtract(beforeDays);
        this.afterDays = afterDays;
        this.reason = reason;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.createdBy = actor;
        this.createdAt = LocalDateTime.now();
    }
}
