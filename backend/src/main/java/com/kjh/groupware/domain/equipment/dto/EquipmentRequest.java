package com.kjh.groupware.domain.equipment.dto;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
public record EquipmentRequest(@NotBlank String equipmentNo, @NotBlank String equipmentName, @NotBlank String equipmentType, @NotBlank String assetNo, Long processId, Long ownerDeptId, String modelName, Integer introducedYear, BigDecimal introducedPrice, String manufacturer, String status) {}
