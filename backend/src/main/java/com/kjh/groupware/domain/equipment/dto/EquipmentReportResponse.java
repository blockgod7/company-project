package com.kjh.groupware.domain.equipment.dto;

import com.kjh.groupware.domain.equipment.EquipmentReport;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record EquipmentReportResponse(Long reportId, Long equipmentId, String equipmentNo, String equipmentName, String title, String symptom, String requestContent, String priority, LocalDate occurredOn, String state, Long reporterEmpId, String reporterName, Long assigneeEmpId, String assigneeName, LocalDate plannedStartOn, LocalDate plannedEndOn, String assignmentInstruction, String workResult, String causeAnalysis, String actionTaken, Long initialApprovalId, Long completionApprovalId, LocalDateTime createdAt) {
    public static EquipmentReportResponse from(EquipmentReport value) {
        return new EquipmentReportResponse(value.getReportId(), value.getEquipment().getEquipmentId(), value.getEquipment().getEquipmentNo(), value.getEquipment().getEquipmentName(), value.getTitle(), value.getSymptom(), value.getRequestContent(), value.getPriority(), value.getOccurredOn(), value.getState(), value.getReporter().getEmpId(), value.getReporter().getEmpName(), value.getAssignee() == null ? null : value.getAssignee().getEmpId(), value.getAssignee() == null ? null : value.getAssignee().getEmpName(), value.getPlannedStartOn(), value.getPlannedEndOn(), value.getAssignmentInstruction(), value.getWorkResult(), value.getCauseAnalysis(), value.getActionTaken(), value.getInitialApprovalId(), value.getCompletionApprovalId(), value.getCreatedAt());
    }
}
