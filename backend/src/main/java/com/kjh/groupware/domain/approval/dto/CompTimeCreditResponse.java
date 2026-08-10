package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.CompTimeCredit;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record CompTimeCreditResponse(
    Long creditId,
    Long empId,
    String empName,
    LocalDate workDate,
    BigDecimal grantedDays,
    BigDecimal reservedDays,
    BigDecimal usedDays,
    BigDecimal availableDays,
    String reason,
    Long grantedByEmpId,
    String grantedByName,
    LocalDate expiresOn,
    String status,
    LocalDateTime createdAt
) {
    public static CompTimeCreditResponse from(CompTimeCredit credit, LocalDate today) {
        String status = credit.availableDays().signum() > 0 && credit.getExpiresOn().isBefore(today)
            ? "EXPIRED"
            : credit.availableDays().signum() == 0 ? "EXHAUSTED" : "ACTIVE";
        return new CompTimeCreditResponse(
            credit.getCreditId(), credit.getEmp().getEmpId(), credit.getEmp().getEmpName(), credit.getWorkDate(),
            credit.getGrantedDays(), credit.getReservedDays(), credit.getUsedDays(), credit.availableDays(), credit.getReason(),
            credit.getGrantedBy().getEmpId(), credit.getGrantedBy().getEmpName(), credit.getExpiresOn(), status, credit.getCreatedAt()
        );
    }
}
