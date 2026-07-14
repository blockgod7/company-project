package com.kjh.groupware.domain.equipment.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
public record EquipmentReportRequest(@NotNull Long equipmentId, @NotBlank String title, @NotBlank String symptom, @NotBlank String requestContent, String priority, LocalDate occurredOn) {}
