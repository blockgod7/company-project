package com.kjh.groupware.domain.emp;

import com.kjh.groupware.domain.approval.AnnualLeaveService;
import com.kjh.groupware.domain.approval.EmployeeLeaveLifecycleService;
import com.kjh.groupware.domain.auth.AuthRefreshTokenRepository;
import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.domain.dept.DeptRepository;
import com.kjh.groupware.domain.emp.dto.EmployeeAccountIssueRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeCreateRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeGenderRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeLeaveRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeLeaveImpactResponse;
import com.kjh.groupware.domain.emp.dto.EmployeeManagementResponse;
import com.kjh.groupware.domain.emp.dto.EmployeeRehireRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeRetireRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeUpdateRequest;
import com.kjh.groupware.domain.emp.dto.EmployeeWorkCategoryRequest;
import com.kjh.groupware.domain.emp.dto.TemporaryPasswordResponse;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class EmployeeManagementService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final EmpRepository empRepository;
    private final DeptRepository deptRepository;
    private final EmpEmploymentHistoryRepository employmentHistoryRepository;
    private final EmpLeavePeriodRepository leavePeriodRepository;
    private final EmployeePermissionService permissionService;
    private final CurrentEmpProvider currentEmpProvider;
    private final PasswordEncoder passwordEncoder;
    private final AuthRefreshTokenRepository refreshTokenRepository;
    private final AnnualLeaveService annualLeaveService;
    private final EmployeeLeaveLifecycleService leaveLifecycleService;

    @Transactional(readOnly = true)
    public List<EmployeeManagementResponse> findAll() {
        permissionService.requireEmployeeOrWorkCategoryAdmin();
        return empRepository.findAllByOrderByEmpNameAsc().stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public EmployeeManagementResponse findOne(Long empId) {
        permissionService.requireEmployeeOrWorkCategoryAdmin();
        return response(find(empId));
    }

    @Transactional(readOnly = true)
    public EmployeeLeaveImpactResponse retirementImpact(Long empId, java.time.LocalDate retireDate) {
        permissionService.requireEmployeeAdmin();
        return leaveLifecycleService.retirementImpact(find(empId), retireDate);
    }

    @Transactional(readOnly = true)
    public EmployeeLeaveImpactResponse leaveImpact(Long empId, java.time.LocalDate startDate, java.time.LocalDate endDate) {
        permissionService.requireEmployeeAdmin();
        if (endDate.isBefore(startDate)) throw BusinessException.badRequest("LEAVE_PERIOD_INVALID", "휴직 종료일은 시작일보다 빠를 수 없습니다.");
        return leaveLifecycleService.leaveImpact(find(empId), startDate, endDate);
    }

    @Transactional
    public EmployeeManagementResponse create(EmployeeCreateRequest request) {
        permissionService.requireEmployeeAdmin();
        validateEmployment(request.employmentType(), request.contractStartDate(), request.contractEndDate());
        if (empRepository.existsByEmpNo(request.empNo().trim())) {
            throw BusinessException.badRequest("EMP_NO_DUPLICATED", "이미 사용 중인 사번입니다.");
        }
        Emp emp = Emp.pending(
            request.empNo().trim(), request.empName().trim(), request.genderCode(), normalize(request.email()), normalize(request.phone()), normalize(request.extensionNumber()),
            dept(request.deptId()), normalize(request.positionName()), normalize(request.jobTitle()), manager(request.managerEmpId()),
            request.hireDate(), request.employmentType(), request.contractStartDate(), request.contractEndDate()
        );
        empRepository.save(emp);
        employmentHistoryRepository.save(new EmpEmploymentHistory(emp, request.hireDate(), request.employmentType(), false));
        annualLeaveService.initializeEmployee(emp);
        return response(emp);
    }

    @Transactional
    public EmployeeManagementResponse update(Long empId, EmployeeUpdateRequest request) {
        Emp actor = currentEmpProvider.getCurrentEmp();
        Emp emp = find(empId);
        permissionService.assertCanEditTarget(actor, emp);
        validateEmployment(request.employmentType(), request.contractStartDate(), request.contractEndDate());
        java.time.LocalDate previousEmploymentStartDate = emp.currentEmploymentStartDate();
        String previousEmploymentType = emp.getEmploymentType();
        java.time.LocalDate previousContractStartDate = emp.getContractStartDate();
        java.time.LocalDate previousContractEndDate = emp.getContractEndDate();
        emp.updateProfile(
            request.empName().trim(), request.genderCode(), normalize(request.email()), normalize(request.phone()), normalize(request.extensionNumber()),
            dept(request.deptId()), normalize(request.positionName()), normalize(request.jobTitle()), manager(request.managerEmpId()),
            request.hireDate(), request.employmentType(), request.contractStartDate(), request.contractEndDate()
        );
        boolean calculationInputChanged = !Objects.equals(previousEmploymentStartDate, emp.currentEmploymentStartDate())
            || !Objects.equals(previousEmploymentType, emp.getEmploymentType())
            || !Objects.equals(previousContractStartDate, emp.getContractStartDate())
            || !Objects.equals(previousContractEndDate, emp.getContractEndDate());
        if (calculationInputChanged) {
            employmentHistoryRepository.findFirstByEmpEmpIdAndEndDateIsNullOrderByStartDateDesc(empId)
                .ifPresent(history -> history.revise(emp.currentEmploymentStartDate(), emp.getEmploymentType()));
            annualLeaveService.recalculateForEmploymentChange(emp, actor);
        }
        return response(emp);
    }

    @Transactional
    public EmployeeManagementResponse updateWorkCategory(Long empId, EmployeeWorkCategoryRequest request) {
        permissionService.requireWorkCategoryAdmin();
        Emp emp = find(empId);
        if ("ADMIN".equals(emp.getRoleCode()) && !"ADMIN".equals(currentEmpProvider.getCurrentEmp().getRoleCode())) {
            throw BusinessException.forbidden("SYSTEM_ADMIN_PROTECTED", "시스템관리자 계정은 변경할 수 없습니다.");
        }
        emp.updateWorkCategory(request.workCategory());
        return response(emp);
    }

    @Transactional
    public EmployeeManagementResponse updateGender(Long empId, EmployeeGenderRequest request) {
        Emp actor = currentEmpProvider.getCurrentEmp();
        Emp emp = find(empId);
        permissionService.assertCanEditTarget(actor, emp);
        emp.updateGender(request.genderCode());
        return response(emp);
    }

    @Transactional
    public EmployeeManagementResponse retire(Long empId, EmployeeRetireRequest request) {
        Emp actor = currentEmpProvider.getCurrentEmp();
        Emp emp = find(empId);
        permissionService.assertCanEditTarget(actor, emp);
        if (request.retireDate().isBefore(emp.currentEmploymentStartDate())) {
            throw BusinessException.badRequest("RETIRE_DATE_INVALID", "퇴직일은 현재 근로 시작일보다 빠를 수 없습니다.");
        }
        employmentHistoryRepository.findFirstByEmpEmpIdAndEndDateIsNullOrderByStartDateDesc(empId)
            .ifPresent(history -> history.close(request.retireDate()));
        emp.retire(request.retireDate());
        permissionService.revokeAllForRetirement(emp, actor);
        leaveLifecycleService.cancelForRetirement(emp, request.retireDate());
        emp.deactivateAccount();
        refreshTokenRepository.deleteByEmp(emp);
        return response(emp);
    }

    @Transactional
    public EmployeeManagementResponse startLeave(Long empId, EmployeeLeaveRequest request) {
        Emp actor = currentEmpProvider.getCurrentEmp();
        Emp emp = find(empId);
        permissionService.assertCanEditTarget(actor, emp);
        if (request.endDate().isBefore(request.startDate())) {
            throw BusinessException.badRequest("LEAVE_PERIOD_INVALID", "휴직 종료일은 시작일보다 빠를 수 없습니다.");
        }
        if (leavePeriodRepository.findFirstByEmpEmpIdAndStatusOrderByStartDateDesc(empId, "ACTIVE").isPresent()) {
            throw BusinessException.badRequest("LEAVE_ALREADY_ACTIVE", "이미 진행 중인 휴직이 있습니다.");
        }
        leavePeriodRepository.save(new EmpLeavePeriod(emp, request.leaveType(), request.startDate(), request.endDate(), request.note()));
        leaveLifecycleService.cancelForEmployeeLeave(emp, request.startDate(), request.endDate());
        emp.markLeave();
        return response(emp);
    }

    @Transactional
    public EmployeeManagementResponse returnFromLeave(Long empId) {
        Emp actor = currentEmpProvider.getCurrentEmp();
        Emp emp = find(empId);
        permissionService.assertCanEditTarget(actor, emp);
        EmpLeavePeriod period = leavePeriodRepository.findFirstByEmpEmpIdAndStatusOrderByStartDateDesc(empId, "ACTIVE")
            .orElseThrow(() -> BusinessException.badRequest("ACTIVE_LEAVE_NOT_FOUND", "진행 중인 휴직이 없습니다."));
        period.end();
        emp.returnFromLeave();
        return response(emp);
    }

    @Transactional
    public EmployeeManagementResponse rehire(Long empId, EmployeeRehireRequest request) {
        Emp actor = currentEmpProvider.getCurrentEmp();
        Emp emp = find(empId);
        permissionService.assertCanEditTarget(actor, emp);
        if (!"RETIRED".equals(emp.getStatus())) {
            throw BusinessException.badRequest("EMP_NOT_RETIRED", "퇴직 상태 직원만 재입사 처리할 수 있습니다.");
        }
        validateEmployment(request.employmentType(), request.contractStartDate(), request.contractEndDate());
        emp.rehire(request.rehireDate(), request.employmentType(), request.contractStartDate(), request.contractEndDate());
        employmentHistoryRepository.save(new EmpEmploymentHistory(emp, request.rehireDate(), request.employmentType(), true));
        annualLeaveService.reinitializeForRehire(emp, actor);
        return response(emp);
    }

    @Transactional
    public TemporaryPasswordResponse issueAccount(Long empId, EmployeeAccountIssueRequest request) {
        permissionService.requireAccountAdmin();
        Emp emp = find(empId);
        String loginId = request.loginId().trim();
        if (empRepository.existsByLoginId(loginId) && !loginId.equals(emp.getLoginId())) {
            throw BusinessException.badRequest("LOGIN_ID_DUPLICATED", "이미 사용 중인 로그인 ID입니다.");
        }
        return issueTemporaryPassword(emp, loginId);
    }

    @Transactional
    public TemporaryPasswordResponse resetPassword(Long empId) {
        permissionService.requireAccountAdmin();
        Emp emp = find(empId);
        if (!StringUtils.hasText(emp.getLoginId())) {
            throw BusinessException.badRequest("ACCOUNT_NOT_ISSUED", "먼저 로그인 계정을 발급해 주세요.");
        }
        return issueTemporaryPassword(emp, emp.getLoginId());
    }

    @Transactional
    public EmployeeManagementResponse unlock(Long empId) {
        permissionService.requireAccountAdmin();
        Emp emp = find(empId);
        emp.unlockAccount();
        return response(emp);
    }

    private TemporaryPasswordResponse issueTemporaryPassword(Emp emp, String loginId) {
        String temporaryPassword = "Dox-" + String.format("%06d", RANDOM.nextInt(1_000_000));
        LocalDateTime expiresAt = LocalDateTime.now().plusHours(24);
        emp.issueAccount(loginId, passwordEncoder.encode(temporaryPassword), expiresAt);
        refreshTokenRepository.deleteByEmp(emp);
        return new TemporaryPasswordResponse(emp.getEmpId(), loginId, temporaryPassword, expiresAt);
    }

    private EmployeeManagementResponse response(Emp emp) {
        return EmployeeManagementResponse.from(emp, permissionService.permissionsFor(emp));
    }

    private Emp find(Long empId) {
        return empRepository.findById(empId)
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "직원을 찾을 수 없습니다."));
    }

    private Dept dept(Long deptId) {
        if (deptId == null) return null;
        return deptRepository.findById(deptId)
            .orElseThrow(() -> BusinessException.notFound("DEPT_NOT_FOUND", "부서를 찾을 수 없습니다."));
    }

    private Emp manager(Long managerEmpId) {
        return managerEmpId == null ? null : find(managerEmpId);
    }

    private void validateEmployment(String employmentType, java.time.LocalDate contractStart, java.time.LocalDate contractEnd) {
        if ("CONTRACT".equals(employmentType)) {
            if (contractStart == null || contractEnd == null || contractEnd.isBefore(contractStart)) {
                throw BusinessException.badRequest("CONTRACT_PERIOD_INVALID", "계약직은 올바른 계약 시작일과 종료일이 필요합니다.");
            }
        }
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
