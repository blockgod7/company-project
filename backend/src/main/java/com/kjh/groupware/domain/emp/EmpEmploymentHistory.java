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
@Table(name = "emp_employment_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmpEmploymentHistory extends BaseEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "employment_history_id")
    private Long employmentHistoryId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "employment_type", nullable = false, length = 20)
    private String employmentType;

    @Column(name = "rehire_yn", nullable = false, length = 1)
    private String rehireYn;

    public EmpEmploymentHistory(Emp emp, LocalDate startDate, String employmentType, boolean rehired) {
        this.emp = emp;
        this.startDate = startDate;
        this.employmentType = employmentType;
        this.rehireYn = rehired ? "Y" : "N";
    }

    public void close(LocalDate endDate) {
        this.endDate = endDate;
    }

    public void revise(LocalDate startDate, String employmentType) {
        this.startDate = startDate;
        this.employmentType = employmentType;
    }
}
