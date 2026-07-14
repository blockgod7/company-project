package com.kjh.groupware.domain.equipment.dto;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
public record EquipmentAssignmentRequest(@NotNull Long assigneeEmpId, LocalDate plannedStartOn, LocalDate plannedEndOn, String instruction) {}
