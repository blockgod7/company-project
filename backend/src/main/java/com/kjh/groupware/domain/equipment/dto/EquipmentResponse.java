package com.kjh.groupware.domain.equipment.dto;

import com.kjh.groupware.domain.equipment.Equipment;

public record EquipmentResponse(Long equipmentId, String equipmentNo, String equipmentName, String equipmentType, String assetNo, Long processId, String processName, Long ownerDeptId, String ownerDeptName, String modelName, Integer introducedYear, java.math.BigDecimal introducedPrice, String manufacturer, String status) {
    public static EquipmentResponse from(Equipment value) {
        return new EquipmentResponse(value.getEquipmentId(), value.getEquipmentNo(), value.getEquipmentName(), value.getEquipmentType(), value.getAssetNo(),
            value.getProcess() == null ? null : value.getProcess().getProcessId(), value.getProcess() == null ? value.getLocation() : value.getProcess().getProcessName(),
            value.getOwnerDept() == null ? null : value.getOwnerDept().getDeptId(), value.getOwnerDept() == null ? null : value.getOwnerDept().getDeptName(),
            value.getModelName(), value.getIntroducedYear(), value.getIntroducedPrice(), value.getManufacturer(), value.getStatus());
    }
}
