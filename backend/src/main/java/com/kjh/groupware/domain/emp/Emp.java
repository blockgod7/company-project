package com.kjh.groupware.domain.emp;

import com.kjh.groupware.domain.dept.Dept;
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
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "emp")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Emp extends BaseEntity {

    private static final int MAX_LOGIN_FAIL_COUNT = 5;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "emp_id")
    private Long empId;

    @Column(name = "emp_no", nullable = false, unique = true, length = 30)
    private String empNo;

    @Column(name = "login_id", nullable = false, unique = true, length = 50)
    private String loginId;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "emp_name", nullable = false, length = 100)
    private String empName;

    @Column(name = "email", length = 150)
    private String email;

    @Column(name = "phone", length = 50)
    private String phone;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dept_id")
    private Dept dept;

    @Column(name = "position_name", length = 50)
    private String positionName;

    @Column(name = "job_title", length = 50)
    private String jobTitle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "manager_emp_id")
    private Emp manager;

    @Column(name = "role_code", nullable = false, length = 30)
    private String roleCode;

    @Column(name = "hire_date")
    private LocalDate hireDate;

    @Column(name = "retire_date")
    private LocalDate retireDate;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "login_fail_count", nullable = false)
    private Integer loginFailCount;

    @Column(name = "account_locked_yn", nullable = false, length = 1)
    private String accountLockedYn;

    @Column(name = "password_changed_at")
    private LocalDateTime passwordChangedAt;

    @Column(name = "use_yn", nullable = false, length = 1)
    private String useYn;

    public boolean isActiveUser() {
        return "Y".equals(useYn) && "ACTIVE".equals(status);
    }

    public boolean isAccountLocked() {
        return "Y".equals(accountLockedYn);
    }

    public void recordLoginSuccess() {
        this.loginFailCount = 0;
        this.lastLoginAt = LocalDateTime.now();
    }

    public void recordLoginFailure() {
        int failCount = loginFailCount == null ? 0 : loginFailCount;
        this.loginFailCount = failCount + 1;
        if (this.loginFailCount >= MAX_LOGIN_FAIL_COUNT) {
            this.accountLockedYn = "Y";
        }
    }
}
