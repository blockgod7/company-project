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
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import com.kjh.groupware.domain.work.WorkRequestEntry;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
    name = "comp_time_credit",
    uniqueConstraints = @UniqueConstraint(name = "uk_comp_time_credit_emp_work_date", columnNames = {"emp_id", "work_date"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CompTimeCredit extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "credit_id")
    private Long creditId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @Column(name = "work_date", nullable = false)
    private LocalDate workDate;

    @Column(name = "granted_days", nullable = false, precision = 3, scale = 1)
    private BigDecimal grantedDays;

    @Column(name = "reserved_days", nullable = false, precision = 3, scale = 1)
    private BigDecimal reservedDays;

    @Column(name = "used_days", nullable = false, precision = 3, scale = 1)
    private BigDecimal usedDays;

    @Column(name = "reason", nullable = false, length = 500)
    private String reason;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "granted_by", nullable = false)
    private Emp grantedBy;

    @Column(name = "expires_on", nullable = false)
    private LocalDate expiresOn;

    @Column(name = "expiration_notified_at")
    private LocalDateTime expirationNotifiedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_work_entry_id")
    private WorkRequestEntry sourceWorkEntry;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    public CompTimeCredit(Emp emp, LocalDate workDate, BigDecimal grantedDays, String reason, Emp grantedBy, LocalDate expiresOn) {
        this.emp = emp;
        this.workDate = workDate;
        this.grantedDays = grantedDays;
        this.reservedDays = BigDecimal.ZERO;
        this.usedDays = BigDecimal.ZERO;
        this.reason = reason;
        this.grantedBy = grantedBy;
        this.expiresOn = expiresOn;
    }

    public CompTimeCredit(Emp emp, LocalDate workDate, BigDecimal grantedDays, String reason, Emp grantedBy,
                          LocalDate expiresOn, WorkRequestEntry sourceWorkEntry) {
        this(emp, workDate, grantedDays, reason, grantedBy, expiresOn);
        this.sourceWorkEntry = sourceWorkEntry;
    }

    public BigDecimal availableDays() {
        return grantedDays.subtract(reservedDays).subtract(usedDays);
    }

    public void reserve(BigDecimal days) {
        if (days.signum() <= 0 || availableDays().compareTo(days) < 0) {
            throw new IllegalStateException("Insufficient compensatory time credit");
        }
        reservedDays = reservedDays.add(days);
    }

    public void release(BigDecimal days) {
        if (days.signum() <= 0 || reservedDays.compareTo(days) < 0) {
            throw new IllegalStateException("Invalid compensatory time release");
        }
        reservedDays = reservedDays.subtract(days);
    }

    public void consume(BigDecimal days) {
        release(days);
        usedDays = usedDays.add(days);
    }

    public void restore(BigDecimal days) {
        if (days.signum() <= 0 || usedDays.compareTo(days) < 0) {
            throw new IllegalStateException("Invalid compensatory time restoration");
        }
        usedDays = usedDays.subtract(days);
    }

    public void reuse(BigDecimal days) {
        if (days.signum() <= 0 || availableDays().compareTo(days) < 0) {
            throw new IllegalStateException("Invalid compensatory time reuse");
        }
        usedDays = usedDays.add(days);
    }

    public void extendExpiry(LocalDate newExpiresOn) {
        this.expiresOn = newExpiresOn;
        this.expirationNotifiedAt = null;
    }

    public void markExpirationNotified() {
        this.expirationNotifiedAt = LocalDateTime.now();
    }
}
