package com.kjh.groupware.domain.approval.dto;
public record AnnualLeaveResponse(
    Long empId,
    String empName,
    String deptName,
    int leaveYear,
    String autoCalculatedDays,
    String finalDays,
    String calculationMode,
    String confirmationStatus,
    String calculationBasis,
    String adjustmentReason
) {}
