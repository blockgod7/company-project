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

    @Column(name = "login_id", unique = true, length = 50)
    private String loginId;

    @Column(name = "password_hash")
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

    @Column(name = "gender_code", nullable = false, length = 10)
    private String genderCode;

    @Column(name = "employment_type", nullable = false, length = 20)
    private String employmentType;

    @Column(name = "work_category", nullable = false, length = 20)
    private String workCategory;

    @Column(name = "contract_start_date")
    private LocalDate contractStartDate;

    @Column(name = "contract_end_date")
    private LocalDate contractEndDate;

    @Column(name = "rehire_date")
    private LocalDate rehireDate;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "login_fail_count", nullable = false)
    private Integer loginFailCount;

    @Column(name = "account_locked_yn", nullable = false, length = 1)
    private String accountLockedYn;

    @Column(name = "account_status", nullable = false, length = 20)
    private String accountStatus;

    @Column(name = "temp_password_expires_at")
    private LocalDateTime tempPasswordExpiresAt;

    @Column(name = "must_change_password_yn", nullable = false, length = 1)
    private String mustChangePasswordYn;

    @Column(name = "password_changed_at")
    private LocalDateTime passwordChangedAt;

    @Column(name = "use_yn", nullable = false, length = 1)
    private String useYn;

    public boolean isActiveUser() {
        return "Y".equals(useYn) && "ACTIVE".equals(status) && "ACTIVE".equals(accountStatus);
    }

    public boolean isAccountLocked() {
        return "Y".equals(accountLockedYn);
    }

    public void recordLoginSuccess() {
        this.loginFailCount = 0;
        this.lastLoginAt = LocalDateTime.now();
    }

    public boolean isTemporaryPasswordExpired(LocalDateTime now) {
        return "Y".equals(mustChangePasswordYn)
            && tempPasswordExpiresAt != null
            && !tempPasswordExpiresAt.isAfter(now);
    }

    public LocalDate currentEmploymentStartDate() {
        return rehireDate == null ? hireDate : rehireDate;
    }

    public boolean isContractEmployee() {
        return "CONTRACT".equals(employmentType);
    }

    public boolean isRehired() {
        return rehireDate != null;
    }

    public static Emp pending(
        String empNo,
        String empName,
        String genderCode,
        String email,
        String phone,
        Dept dept,
        String positionName,
        String jobTitle,
        Emp manager,
        LocalDate hireDate,
        String employmentType,
        LocalDate contractStartDate,
        LocalDate contractEndDate
    ) {
        Emp emp = new Emp();
        emp.empNo = empNo;
        emp.empName = empName;
        emp.genderCode = genderCode;
        emp.email = email;
        emp.phone = phone;
        emp.dept = dept;
        emp.positionName = positionName;
        emp.jobTitle = jobTitle;
        emp.manager = manager;
        emp.roleCode = "USER";
        emp.hireDate = hireDate;
        emp.employmentType = employmentType;
        emp.workCategory = "FIELD";
        emp.contractStartDate = contractStartDate;
        emp.contractEndDate = contractEndDate;
        emp.status = "ACTIVE";
        emp.loginFailCount = 0;
        emp.accountLockedYn = "N";
        emp.accountStatus = "ACCOUNT_PENDING";
        emp.mustChangePasswordYn = "N";
        emp.useYn = "Y";
        return emp;
    }

    public void updateProfile(
        String empName,
        String genderCode,
        String email,
        String phone,
        Dept dept,
        String positionName,
        String jobTitle,
        Emp manager,
        LocalDate hireDate,
        String employmentType,
        LocalDate contractStartDate,
        LocalDate contractEndDate
    ) {
        this.empName = empName;
        this.genderCode = genderCode;
        this.email = email;
        this.phone = phone;
        this.dept = dept;
        this.positionName = positionName;
        this.jobTitle = jobTitle;
        this.manager = manager;
        this.hireDate = hireDate;
        this.employmentType = employmentType;
        this.contractStartDate = contractStartDate;
        this.contractEndDate = contractEndDate;
    }

    public void updateWorkCategory(String workCategory) {
        this.workCategory = workCategory;
    }

    public void markLeave() {
        this.status = "LEAVE";
    }

    public void returnFromLeave() {
        this.status = "ACTIVE";
    }

    public void retire(LocalDate retireDate) {
        this.retireDate = retireDate;
        this.status = "RETIRED";
    }

    public void rehire(LocalDate rehireDate, String employmentType, LocalDate contractStartDate, LocalDate contractEndDate) {
        this.rehireDate = rehireDate;
        this.retireDate = null;
        this.employmentType = employmentType;
        this.contractStartDate = contractStartDate;
        this.contractEndDate = contractEndDate;
        this.status = "ACTIVE";
        this.accountStatus = "INACTIVE";
    }

    public void issueAccount(String loginId, String passwordHash, LocalDateTime expiresAt) {
        this.loginId = loginId;
        this.passwordHash = passwordHash;
        this.accountStatus = "ACTIVE";
        this.accountLockedYn = "N";
        this.loginFailCount = 0;
        this.mustChangePasswordYn = "Y";
        this.tempPasswordExpiresAt = expiresAt;
        this.passwordChangedAt = LocalDateTime.now();
    }

    public void deactivateAccount() {
        this.accountStatus = "INACTIVE";
    }

    public void unlockAccount() {
        this.accountLockedYn = "N";
        this.loginFailCount = 0;
    }

    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
        this.mustChangePasswordYn = "N";
        this.tempPasswordExpiresAt = null;
        this.passwordChangedAt = LocalDateTime.now();
    }

    public void recordLoginFailure() {
        int failCount = loginFailCount == null ? 0 : loginFailCount;
        this.loginFailCount = failCount + 1;
        if (this.loginFailCount >= MAX_LOGIN_FAIL_COUNT) {
            this.accountLockedYn = "Y";
        }
    }
}
