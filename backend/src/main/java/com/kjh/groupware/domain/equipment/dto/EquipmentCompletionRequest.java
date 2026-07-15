package com.kjh.groupware.domain.equipment.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
public record EquipmentCompletionRequest(@NotBlank String workResult, String causeAnalysis, @NotBlank String actionTaken, @NotNull LocalDate completedOn, @NotNull @DecimalMin(value = "0.01") BigDecimal workDurationHours, List<Long> approverEmpIds) {}
