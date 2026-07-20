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
    @Column(name = "reset_at", nullable = false) private LocalDateTime resetAt;
    @Column(name = "updated_at") private LocalDateTime updatedAt;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "updated_by") private Emp updatedBy;

    public EmpAnnualLeave(Emp emp, int year, BigDecimal grantedDays) {
        this.emp = emp; this.leaveYear = year; this.grantedDays = grantedDays;
        this.adjustmentDays = BigDecimal.ZERO; this.resetAt = LocalDateTime.now();
    }
    public void adjust(BigDecimal adjustmentDays, String reason, Emp editor) {
        this.adjustmentDays = adjustmentDays; this.adjustmentReason = reason;
        this.updatedBy = editor; this.updatedAt = LocalDateTime.now();
    }
}
