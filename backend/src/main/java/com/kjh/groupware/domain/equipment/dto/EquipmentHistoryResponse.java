package com.kjh.groupware.domain.equipment.dto;

import com.kjh.groupware.domain.equipment.EquipmentHistoryEvent;
import java.time.LocalDateTime;

public record EquipmentHistoryResponse(Long eventId, Long reportId, String eventType, String message, Long actorEmpId, String actorName, LocalDateTime createdAt) {
    public static EquipmentHistoryResponse from(EquipmentHistoryEvent value) {
        return new EquipmentHistoryResponse(value.getEventId(), value.getReport().getReportId(), value.getEventType(), value.getMessage(), value.getActor() == null ? null : value.getActor().getEmpId(), value.getActor() == null ? null : value.getActor().getEmpName(), value.getCreatedAt());
    }
}
