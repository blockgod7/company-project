package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.*;
import com.kjh.groupware.domain.emp.*;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.*;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class AnnualLeaveService {
    private final EmpAnnualLeaveRepository leaveRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;

    @Transactional public BigDecimal totalDays(Emp emp, int year) { return ensure(emp, year).getGrantedDays().add(ensure(emp, year).getAdjustmentDays()); }
    @Transactional public List<AnnualLeaveResponse> currentForHr() { requireHr(); int year=LocalDate.now().getYear(); empRepository.findAll().stream().filter(Emp::isActiveUser).forEach(e->ensure(e,year)); return leaveRepository.findByLeaveYearOrderByEmpEmpNameAsc(year).stream().map(this::response).toList(); }
    @Transactional public AnnualLeaveResponse adjust(AnnualLeaveAdjustmentRequest request) { requireHr(); Emp editor=currentEmpProvider.getCurrentEmp(); Emp emp=empRepository.findById(request.empId()).orElseThrow(()->BusinessException.notFound("EMP_NOT_FOUND","Employee not found")); EmpAnnualLeave leave=ensure(emp,LocalDate.now().getYear()); leave.adjust(request.adjustmentDays(),request.reason(),editor); return response(leave); }
    @Scheduled(cron="0 0 0 1 1 *", zone="Asia/Seoul") @Transactional public void resetAnnualLeaves() { int y=LocalDate.now().getYear(); empRepository.findAll().stream().filter(Emp::isActiveUser).forEach(e->ensure(e,y)); }
    @Scheduled(cron="0 5 0 1 * *", zone="Asia/Seoul") @Transactional public void grantNewHireMonthlyLeave() { LocalDate today=LocalDate.now(), first=today.minusMonths(1).withDayOfMonth(1); empRepository.findAll().stream().filter(Emp::isActiveUser).filter(e->e.getHireDate()!=null&&e.getHireDate().getYear()==today.getYear()&&!e.getHireDate().isAfter(first)).forEach(e->{ EmpAnnualLeave leave=ensure(e,today.getYear()); leave.adjust(leave.getAdjustmentDays().add(BigDecimal.ONE),"Monthly leave grant",null); }); }
    private EmpAnnualLeave ensure(Emp emp,int year) { return leaveRepository.findByEmpEmpIdAndLeaveYear(emp.getEmpId(),year).orElseGet(()->leaveRepository.save(new EmpAnnualLeave(emp,year,base(emp,year)))); }
    private BigDecimal base(Emp emp,int year) { if(emp.getHireDate()==null||emp.getHireDate().getYear()>=year)return BigDecimal.ZERO; int years=year-emp.getHireDate().getYear(); int days=years<=10?14+years:25+(years-11)/2; return BigDecimal.valueOf(Math.min(days,30)); }
    private AnnualLeaveResponse response(EmpAnnualLeave l){ BigDecimal total=l.getGrantedDays().add(l.getAdjustmentDays()); return new AnnualLeaveResponse(l.getEmp().getEmpId(),l.getEmp().getEmpName(),l.getEmp().getDept()==null?null:l.getEmp().getDept().getDeptName(),l.getLeaveYear(),l.getGrantedDays().toPlainString(),l.getAdjustmentDays().toPlainString(),total.toPlainString(),l.getAdjustmentReason()); }
    private void requireHr(){ Emp e=currentEmpProvider.getCurrentEmp(); if(!"ADMIN".equals(e.getRoleCode()) && !(e.getDept()!=null&&"HR_ADMIN".equals(e.getDept().getDeptCode())&&"MANAGER".equals(e.getRoleCode()))) throw BusinessException.forbidden("ANNUAL_LEAVE_FORBIDDEN","HR manager only"); }
}
