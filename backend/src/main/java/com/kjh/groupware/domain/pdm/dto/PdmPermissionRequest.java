package com.kjh.groupware.domain.pdm.dto;

import jakarta.validation.constraints.Size;

public record PdmPermissionRequest(
    Long permissionId,
    @Size(max = 30) String category,
    Long drawingId,
    Long deptId,
    Long empId,
    boolean canRegister,
    boolean canRevise,
    boolean canView,
    boolean canDownloadRequest,
    boolean canDownloadApprove
) {
}
