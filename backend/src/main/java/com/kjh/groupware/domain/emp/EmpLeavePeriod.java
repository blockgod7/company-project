package com.kjh.groupware.domain.emp;

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
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "emp_leave_period")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmpLeavePeriod extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "emp_leave_period_id")
    private Long empLeavePeriodId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @Column(name = "leave_type", nullable = false, length = 40)
    private String leaveType;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "note", length = 500)
    private String note;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    public EmpLeavePeriod(Emp emp, String leaveType, LocalDate startDate, LocalDate endDate, String note) {
        this.emp = emp;
        this.leaveType = leaveType;
        this.startDate = startDate;
        this.endDate = endDate;
        this.note = note;
        this.status = "ACTIVE";
    }

    public void end() {
        this.status = "ENDED";
    }
}
