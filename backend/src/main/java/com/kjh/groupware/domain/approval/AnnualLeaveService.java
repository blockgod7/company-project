package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.AnnualLeaveAdjustmentRequest;
import com.kjh.groupware.domain.approval.dto.AnnualLeaveResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AnnualLeaveService {

    private static final BigDecimal FIFTEEN = new BigDecimal("15.0");
    private static final BigDecimal ELEVEN = new BigDecimal("11.0");
    private static final BigDecimal MAX_DAYS = new BigDecimal("30.0");

    private final EmpAnnualLeaveRepository leaveRepository;
    private final AnnualLeaveLedgerRepository ledgerRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final EmployeePermissionService permissionService;
    private final NotificationService notificationService;
    private final ScheduledJobStatusService scheduledJobStatusService;
    private final ApprovedAnnualLeaveUsageReader approvedUsageReader;

    @Transactional
    public BigDecimal totalDays(Emp emp, int year) {
        return ensure(emp, year).getFinalDays();
    }

    @Transactional
    public void lockForSubmission(Emp emp, int year) {
        Emp lockedEmp = empRepository.findByIdForUpdate(emp.getEmpId())
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "직원을 찾을 수 없습니다."));
        ensure(lockedEmp, year);
        leaveRepository.flush();
        leaveRepository.findByEmpEmpIdAndLeaveYearForUpdate(lockedEmp.getEmpId(), year)
            .orElseThrow(() -> BusinessException.notFound("ANNUAL_LEAVE_NOT_FOUND", "연차 정보를 찾을 수 없습니다."));
    }

    @Transactional
    public void initializeEmployee(Emp emp) {
        ensure(emp, LocalDate.now().getYear());
    }

    @Transactional
    public void recalculateForEmploymentChange(Emp emp, Emp actor) {
        int year = LocalDate.now().getYear();
        EmpAnnualLeave leave = leaveRepository.findByEmpEmpIdAndLeaveYear(emp.getEmpId(), year).orElse(null);
        if (leave != null && leave.isManual()) {
            return;
        }
        Calculation calculation = calculate(emp, year);
        if (leave == null) {
            leave = leaveRepository.save(new EmpAnnualLeave(emp, year, calculation.days()));
        }
        BigDecimal before = leave.getFinalDays();
        leave.recalculate(calculation.days(), calculation.basis(), calculation.confirmationStatus());
        ledgerRepository.save(new AnnualLeaveLedger(
            leave, "EMPLOYMENT_CHANGE_RECALCULATE", before, calculation.days(),
            "고용 형태 또는 근로 시작일 변경에 따른 자동 재계산", "EMPLOYEE", emp.getEmpId(), actor
        ));
    }

    @Transactional
    public void reinitializeForRehire(Emp emp, Emp actor) {
        int year = emp.currentEmploymentStartDate().getYear();
        Calculation calculation = calculate(emp, year);
        EmpAnnualLeave leave = leaveRepository.findByEmpEmpIdAndLeaveYear(emp.getEmpId(), year)
            .orElseGet(() -> leaveRepository.save(new EmpAnnualLeave(emp, year, calculation.days())));
        BigDecimal before = leave.getFinalDays();
        leave.recalculate(calculation.days(), "재입사 · " + calculation.basis(), calculation.confirmationStatus());
        ledgerRepository.save(new AnnualLeaveLedger(
            leave, "REHIRE_RECALCULATE", before, calculation.days(),
            "재입사일 " + emp.currentEmploymentStartDate() + " 기준 연차 재계산", "EMPLOYEE_REHIRE", emp.getEmpId(), actor
        ));
        notificationService.notifyEmp(
            emp.getEmpId(), "재입사 연차 재계산",
            year + "년 연차가 재입사일 기준 " + calculation.days().stripTrailingZeros().toPlainString() + "일로 계산되었습니다.",
            "ANNUAL_LEAVE", (long) year
        );
    }

    @Transactional
    public List<AnnualLeaveResponse> currentForHr(int year) {
        permissionService.requireLeaveAdmin();
        empRepository.findAll().stream()
            .filter(emp -> !"RETIRED".equals(emp.getStatus()))
            .forEach(emp -> ensure(emp, year));
        return leaveRepository.findByLeaveYearOrderByEmpEmpNameAsc(year).stream().map(this::response).toList();
    }

    @Transactional
    public AnnualLeaveResponse adjust(AnnualLeaveAdjustmentRequest request) {
        permissionService.requireLeaveAdmin();
        Emp editor = currentEmpProvider.getCurrentEmp();
        Emp emp = empRepository.findById(request.empId())
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "직원을 찾을 수 없습니다."));
        EmpAnnualLeave leave = ensure(emp, request.leaveYear());
        BigDecimal before = leave.getFinalDays();
        BigDecimal finalDays = normalize(request.finalDays());
        leave.finalizeDays(finalDays, request.reason(), editor);
        ledgerRepository.save(new AnnualLeaveLedger(
            leave, "MANUAL_FINALIZE", before, finalDays, request.reason(), "EMPLOYEE", emp.getEmpId(), editor
        ));
        notificationService.notifyEmp(emp.getEmpId(), "연차 수량 확정", request.leaveYear() + "년 최종 연차가 "
            + finalDays.stripTrailingZeros().toPlainString() + "일로 확정되었습니다. 사유: " + request.reason(), "ANNUAL_LEAVE", (long) request.leaveYear());
        return response(leave);
    }

    @Transactional
    public AnnualLeaveResponse recalculate(Long empId, int year) {
        permissionService.requireLeaveAdmin();
        Emp emp = empRepository.findById(empId)
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "직원을 찾을 수 없습니다."));
        EmpAnnualLeave leave = ensure(emp, year);
        BigDecimal before = leave.getFinalDays();
        Calculation calculation = calculate(emp, year);
        leave.recalculate(calculation.days(), calculation.basis(), calculation.confirmationStatus());
        ledgerRepository.save(new AnnualLeaveLedger(
            leave, "RECALCULATE", before, calculation.days(), "연차 자동 재계산", "EMPLOYEE", empId,
            currentEmpProvider.getCurrentEmp()
        ));
        notificationService.notifyEmp(empId, "연차 자동 재계산", year + "년 연차가 "
            + calculation.days().stripTrailingZeros().toPlainString() + "일로 재계산되었습니다.", "ANNUAL_LEAVE", (long) year);
        return response(leave);
    }

    @Scheduled(cron = "0 0 0 1 1 *", zone = "Asia/Seoul")
    @Transactional
    public void resetAnnualLeaves() {
        String job = "annual-leave-january-reset";
        scheduledJobStatusService.start(job);
        try {
            int year = LocalDate.now().getYear();
            List<Emp> targets = empRepository.findAll().stream().filter(emp -> !"RETIRED".equals(emp.getStatus())).toList();
            targets.forEach(emp -> resetForYear(emp, year));
            scheduledJobStatusService.success(job, year + "년 대상 " + targets.size() + "명 생성/재계산");
        } catch (RuntimeException exception) {
            scheduledJobStatusService.failure(job, exception);
            throw exception;
        }
    }

    private void resetForYear(Emp emp, int year) {
        Calculation calculation = calculate(emp, year);
        EmpAnnualLeave leave = leaveRepository.findByEmpEmpIdAndLeaveYear(emp.getEmpId(), year)
            .orElseGet(() -> leaveRepository.save(new EmpAnnualLeave(emp, year, calculation.days())));
        if (leave.isManual()) {
            return;
        }
        BigDecimal before = leave.getFinalDays();
        leave.recalculate(calculation.days(), calculation.basis(), calculation.confirmationStatus());
        ledgerRepository.save(new AnnualLeaveLedger(
            leave, "JANUARY_RESET", before, calculation.days(), "1월 1일 연차 자동 생성", "SYSTEM", null, null
        ));
        notificationService.notifyEmp(emp.getEmpId(), year + "년 연차 생성", "1월 1일 기준 연차 "
            + calculation.days().stripTrailingZeros().toPlainString() + "일이 생성되었습니다.", "ANNUAL_LEAVE", (long) year);
    }

    private EmpAnnualLeave ensure(Emp emp, int year) {
        return leaveRepository.findByEmpEmpIdAndLeaveYear(emp.getEmpId(), year).orElseGet(() -> {
            Calculation calculation = calculate(emp, year);
            EmpAnnualLeave leave = leaveRepository.save(new EmpAnnualLeave(emp, year, calculation.days()));
            leave.recalculate(calculation.days(), calculation.basis(), calculation.confirmationStatus());
            ledgerRepository.save(new AnnualLeaveLedger(
                leave, "AUTO_GRANT", BigDecimal.ZERO, calculation.days(), calculation.basis(), "EMPLOYEE", emp.getEmpId(), null
            ));
            return leave;
        });
    }

    Calculation calculate(Emp emp, int year) {
        LocalDate start = emp.currentEmploymentStartDate();
        if (start == null || year < start.getYear()) {
            return new Calculation(BigDecimal.ZERO, "근로 시작일 없음 또는 계산연도 이전", confirmationStatus(emp));
        }
        if (emp.isContractEmployee()) {
            return new Calculation(FIFTEEN, "계약직 기본 15일 · 관리자 최종 확인", "CONTRACT_CONFIRM_REQUIRED");
        }
        if (year == start.getYear()) {
            int fullMonths = Math.max(0, 12 - start.getMonthValue() + (start.getDayOfMonth() == 1 ? 1 : 0));
            return new Calculation(BigDecimal.valueOf(fullMonths), "입사 당해 전체 근무월 " + fullMonths + "개월", confirmationStatus(emp));
        }

        long firstYearWorkedDays = ChronoUnit.DAYS.between(start, LocalDate.of(start.getYear() + 1, 1, 1));
        boolean firstYearEightyPercent = firstYearWorkedDays * 100 >= 365L * 80;
        if (year == start.getYear() + 1) {
            BigDecimal baseDays = firstYearEightyPercent
                ? FIFTEEN
                : ceilToHalf(FIFTEEN.multiply(BigDecimal.valueOf(firstYearWorkedDays))
                    .divide(BigDecimal.valueOf(365), 6, RoundingMode.HALF_UP));
            BigDecimal approvedUsedDays = approvedUsageReader.approvedAnnualDays(emp, start.getYear());
            BigDecimal total = baseDays.add(ELEVEN).subtract(approvedUsedDays)
                .max(BigDecimal.ZERO).min(MAX_DAYS);
            return new Calculation(total, "입사 다음 해: 기본 " + baseDays.stripTrailingZeros().toPlainString()
                + "일 + 가산 11일 - 전년도 승인 사용 " + approvedUsedDays.stripTrailingZeros().toPlainString() + "일",
                confirmationStatus(emp));
        }

        int growthYears = Math.max(0, year - start.getYear() - 2);
        BigDecimal total;
        if (growthYears <= 10) {
            total = BigDecimal.valueOf(15L + growthYears);
        } else {
            total = BigDecimal.valueOf(25L + ((growthYears - 10) / 2));
        }
        total = total.min(MAX_DAYS);
        return new Calculation(total, "근속 가산 기준연수 " + growthYears + "년", confirmationStatus(emp));
    }

    private String confirmationStatus(Emp emp) {
        return "LEAVE".equals(emp.getStatus()) ? "LEAVE_CONFIRM_REQUIRED" : "CONFIRMED";
    }

    private BigDecimal roundToHalf(BigDecimal value) {
        return value.multiply(BigDecimal.valueOf(2)).setScale(0, RoundingMode.HALF_UP)
            .divide(BigDecimal.valueOf(2), 1, RoundingMode.UNNECESSARY);
    }

    private BigDecimal ceilToHalf(BigDecimal value) {
        return value.multiply(BigDecimal.valueOf(2)).setScale(0, RoundingMode.CEILING)
            .divide(BigDecimal.valueOf(2), 1, RoundingMode.UNNECESSARY);
    }

    private BigDecimal normalize(BigDecimal value) {
        return roundToHalf(value.max(BigDecimal.ZERO).min(MAX_DAYS));
    }

    private AnnualLeaveResponse response(EmpAnnualLeave leave) {
        return new AnnualLeaveResponse(
            leave.getEmp().getEmpId(), leave.getEmp().getEmpName(),
            leave.getEmp().getDept() == null ? null : leave.getEmp().getDept().getDeptName(),
            leave.getLeaveYear(), leave.getAutoCalculatedDays().toPlainString(), leave.getFinalDays().toPlainString(),
            leave.getCalculationMode(), leave.getConfirmationStatus(), leave.getCalculationBasis(), leave.getAdjustmentReason()
        );
    }

    record Calculation(BigDecimal days, String basis, String confirmationStatus) {}
}
