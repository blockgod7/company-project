package com.kjh.groupware.domain.pdm.dto;

import com.kjh.groupware.domain.pdm.PdmFolder;

public record PdmFolderResponse(
    Long folderId,
    String category,
    String companyName,
    String projectName,
    String businessUnit,
    String processName,
    String folderKind,
    String folderName
) {
    public static PdmFolderResponse from(PdmFolder folder) {
        return new PdmFolderResponse(
            folder.getFolderId(),
            folder.getCategory(),
            folder.getCompanyName(),
            folder.getProjectName(),
            folder.getBusinessUnit(),
            folder.getProcessName(),
            folder.getFolderKind(),
            folder.getFolderName()
        );
    }
}
