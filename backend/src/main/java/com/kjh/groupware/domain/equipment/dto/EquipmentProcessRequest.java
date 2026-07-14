package com.kjh.groupware.domain.equipment.dto;
import jakarta.validation.constraints.NotBlank;
public record EquipmentProcessRequest(@NotBlank String processName, String useYn) {}
