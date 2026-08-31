package com.kjh.groupware.domain.work.dto;

import com.kjh.groupware.domain.work.WorkRequestEntry;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;

public record WorkScheduleResponse(Long workEntryId, Long approvalId, Long empId, String empName, Long deptId,
    String deptName, String workCategory, String shiftType, String scheduledShift, String workType,
    LocalDate workDate, LocalTime startTime, LocalTime endTime, int workMinutes, String workContent,
    boolean compTime, String status) {
    public static WorkScheduleResponse from(WorkRequestEntry item) {
        return new WorkScheduleResponse(item.getWorkEntryId(), item.getApproval().getApprovalId(), item.getEmp().getEmpId(),
            item.getEmpNameSnapshot(), item.getDept() == null ? null : item.getDept().getDeptId(), item.getDeptNameSnapshot(),
            item.getWorkCategorySnapshot(), item.getShiftTypeSnapshot(), scheduledShift(item), item.getWorkType(), item.getWorkDate(),
            item.getStartTime(), item.getEndTime(), item.getWorkMinutes(), item.getWorkContent(), "Y".equals(item.getCompTimeYn()), item.getStatus());
    }
    private static String scheduledShift(WorkRequestEntry item) {
        String type = item.getShiftTypeSnapshot();
        if (type == null) return null;
        if ("DAY_FIXED".equals(type)) return "DAY";
        LocalDate anchor = item.getShiftAnchorDateSnapshot();
        if (anchor == null) return type;
        long block = Math.floorDiv(ChronoUnit.DAYS.between(anchor, item.getWorkDate()), 14);
        boolean first = Math.floorMod(block, 2) == 0;
        return ("A".equals(type) == first) ? "DAY" : "NIGHT";
    }
}
