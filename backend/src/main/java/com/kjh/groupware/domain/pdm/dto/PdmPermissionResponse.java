package com.kjh.groupware.domain.pdm.dto;

public record PdmPermissionResponse(
    boolean canManage,
    boolean canRegister,
    boolean canRevise,
    boolean canView,
    boolean canRequestDownload,
    boolean canApproveDownload
) {
}
