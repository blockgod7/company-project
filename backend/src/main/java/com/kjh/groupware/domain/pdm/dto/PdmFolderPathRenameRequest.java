package com.kjh.groupware.domain.pdm.dto;

import jakarta.validation.constraints.NotBlank;

public record PdmFolderPathRenameRequest(
    @NotBlank String category,
    @NotBlank String folderKind,
    @NotBlank String folderName,
    @NotBlank String newFolderName,
    String companyName,
    String projectName,
    String businessUnit,
    String processName
) {
}
