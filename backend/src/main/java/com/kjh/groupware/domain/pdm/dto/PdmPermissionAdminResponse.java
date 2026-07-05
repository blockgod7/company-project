package com.kjh.groupware.domain.pdm.dto;

import com.kjh.groupware.domain.pdm.PdmDrawingPermission;

public record PdmPermissionAdminResponse(
    Long permissionId,
    String category,
    Long drawingId,
    String drawingNo,
    Long deptId,
    String deptName,
    Long empId,
    String empName,
    boolean canRegister,
    boolean canRevise,
    boolean canView,
    boolean canDownloadRequest,
    boolean canDownloadApprove
) {
    public static PdmPermissionAdminResponse from(PdmDrawingPermission permission) {
        return new PdmPermissionAdminResponse(
            permission.getPermissionId(),
            permission.getCategory(),
            permission.getDrawing() == null ? null : permission.getDrawing().getDrawingId(),
            permission.getDrawing() == null ? null : permission.getDrawing().getDrawingNo(),
            permission.getDept() == null ? null : permission.getDept().getDeptId(),
            permission.getDept() == null ? null : permission.getDept().getDeptName(),
            permission.getEmp() == null ? null : permission.getEmp().getEmpId(),
            permission.getEmp() == null ? null : permission.getEmp().getEmpName(),
            "Y".equals(permission.getCanRegisterYn()),
            "Y".equals(permission.getCanReviseYn()),
            "Y".equals(permission.getCanViewYn()),
            "Y".equals(permission.getCanDownloadRequestYn()),
            "Y".equals(permission.getCanDownloadApproveYn())
        );
    }
}
