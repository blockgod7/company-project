package com.kjh.groupware.domain.equipment.dto;

import jakarta.validation.constraints.NotNull;
public record EquipmentAssignmentAuthorityRequest(@NotNull Long empId) {}
