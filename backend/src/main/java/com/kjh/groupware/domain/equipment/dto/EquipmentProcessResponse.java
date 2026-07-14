package com.kjh.groupware.domain.equipment.dto;
import com.kjh.groupware.domain.equipment.EquipmentProcess;
public record EquipmentProcessResponse(Long processId, String processName, String useYn) {
    public static EquipmentProcessResponse from(EquipmentProcess value) { return new EquipmentProcessResponse(value.getProcessId(), value.getProcessName(), value.getUseYn()); }
}
