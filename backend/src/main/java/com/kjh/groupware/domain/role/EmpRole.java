package com.kjh.groupware.domain.role;

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
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "emp_role")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmpRole extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "emp_role_id")
    private Long empRoleId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "role_id", nullable = false)
    private Role role;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "use_yn", nullable = false, length = 1)
    private String useYn;
}
