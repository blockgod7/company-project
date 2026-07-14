package com.kjh.groupware.domain.equipment.dto;
import jakarta.validation.constraints.NotBlank;
public record EquipmentCompletionRequest(@NotBlank String workResult, String causeAnalysis, @NotBlank String actionTaken) {}
