package com.kjh.groupware.domain.pdm.dto;

import jakarta.validation.constraints.NotBlank;

public record PdmFolderPathRequest(
    @NotBlank String category,
    @NotBlank String folderKind,
    @NotBlank String folderName,
    String companyName,
    String projectName,
    String businessUnit,
    String processName
) {
}
