package com.kjh.groupware.domain.pdm.dto;

import jakarta.validation.constraints.NotBlank;

public record PdmFolderRequest(
    @NotBlank String category,
    String companyName,
    String projectName,
    String businessUnit,
    String processName,
    @NotBlank String folderKind,
    @NotBlank String folderName
) {
}
