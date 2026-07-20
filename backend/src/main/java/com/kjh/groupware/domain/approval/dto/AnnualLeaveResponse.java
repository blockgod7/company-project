package com.kjh.groupware.domain.approval.dto;
public record AnnualLeaveResponse(Long empId, String empName, String deptName, int leaveYear, String grantedDays, String adjustmentDays, String totalDays, String adjustmentReason) {}
