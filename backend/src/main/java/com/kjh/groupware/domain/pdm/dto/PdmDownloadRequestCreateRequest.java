package com.kjh.groupware.domain.pdm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record PdmDownloadRequestCreateRequest(
    @NotBlank String reason,
    @NotEmpty List<Long> approverEmpIds
) {
}
