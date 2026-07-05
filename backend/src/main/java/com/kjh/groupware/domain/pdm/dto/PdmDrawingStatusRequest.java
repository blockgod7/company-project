package com.kjh.groupware.domain.pdm.dto;

import jakarta.validation.constraints.NotBlank;

public record PdmDrawingStatusRequest(
    @NotBlank String status
) {
}
