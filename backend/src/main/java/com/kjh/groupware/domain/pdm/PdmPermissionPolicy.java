package com.kjh.groupware.domain.pdm;

import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.pdm.dto.PdmPermissionRequest;
import com.kjh.groupware.domain.pdm.dto.PdmPermissionResponse;
import com.kjh.groupware.global.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PdmPermissionPolicy {

    private final PdmDrawingPermissionRepository permissionRepository;

    public PdmPermissionResponse permissions(Emp emp, PdmDrawing drawing) {
        boolean admin = isAdmin(emp);
        return new PdmPermissionResponse(
            admin,
            admin || hasPermission(emp, drawing, "register"),
            admin || hasPermission(emp, drawing, "revise"),
            admin || hasPermission(emp, drawing, "view"),
            admin || hasPermission(emp, drawing, "downloadRequest"),
            admin || hasPermission(emp, drawing, "downloadApprove")
        );
    }

    public void assertCanRegister(Emp emp, String category, PdmDrawing drawing) {
        if (!isAdmin(emp) && !hasPermission(emp, category, drawing, "register")) {
            throw BusinessException.forbidden("PDM_REGISTER_FORBIDDEN", "도면 등록 권한이 없습니다.");
        }
    }

    public void assertCanRevise(Emp emp, PdmDrawing drawing) {
        if (!isAdmin(emp) && !hasPermission(emp, drawing, "revise")) {
            throw BusinessException.forbidden("PDM_REVISE_FORBIDDEN", "도면 개정 권한이 없습니다.");
        }
    }

    public void assertCanView(Emp emp, PdmDrawing drawing) {
        if (!canView(emp, drawing)) throw BusinessException.forbidden("PDM_VIEW_FORBIDDEN", "도면 조회 권한이 없습니다.");
    }

    public boolean canView(Emp emp, PdmDrawing drawing) {
        return isAdmin(emp) || drawing.getCreatedByEmpId().equals(emp.getEmpId()) || hasPermission(emp, drawing, "view");
    }

    public void assertCanRequestDownload(Emp emp, PdmDrawing drawing) {
        assertCanView(emp, drawing);
        if (!isAdmin(emp) && !hasPermission(emp, drawing, "downloadRequest")) {
            throw BusinessException.forbidden("PDM_DOWNLOAD_REQUEST_FORBIDDEN", "도면 다운로드 요청 권한이 없습니다.");
        }
    }

    public boolean hasPermission(Emp emp, PdmDrawing drawing, String action) {
        return hasPermission(emp, drawing.getCategory(), drawing, action);
    }

    public boolean hasPermission(Emp emp, String category, PdmDrawing drawing, String action) {
        return permissionRepository.findEffective(emp, emp.getDept()).stream()
            .filter(permission -> permission.getDrawing() == null || (drawing != null && permission.getDrawing().getDrawingId().equals(drawing.getDrawingId())))
            .filter(permission -> permission.getCategory() == null || permission.getCategory().equals(category))
            .anyMatch(permission -> allows(permission, action));
    }

    public void assertCanManagePermissions(Emp emp) {
        if (!isAdmin(emp) && !isDepartmentManager(emp)) {
            throw BusinessException.forbidden("PDM_PERMISSION_MANAGER_FORBIDDEN", "도면 권한을 관리할 수 없습니다.");
        }
    }

    public boolean isAdmin(Emp emp) {
        return emp != null && ("ADMIN".equals(emp.getRoleCode()) || "APPROVAL_ADMIN".equals(emp.getRoleCode()));
    }

    public boolean canManagerViewPermission(Emp manager, PdmDrawingPermission permission) {
        Long managerDeptId = manager.getDept() == null ? null : manager.getDept().getDeptId();
        if (managerDeptId == null) return false;
        if (permission.getDept() != null && managerDeptId.equals(permission.getDept().getDeptId())) return true;
        return permission.getEmp() != null && permission.getEmp().getDept() != null
            && managerDeptId.equals(permission.getEmp().getDept().getDeptId());
    }

    public void assertManagerCanAssignPermission(Emp manager, String category, PdmDrawing drawing, Dept dept, Emp emp, PdmPermissionRequest request) {
        if (!isDepartmentManager(manager)) {
            throw BusinessException.forbidden("PDM_PERMISSION_MANAGER_FORBIDDEN", "부서장만 직원 권한을 배정할 수 있습니다.");
        }
        if (drawing != null || dept != null || emp == null) {
            throw BusinessException.forbidden("PDM_PERMISSION_MANAGER_TARGET_FORBIDDEN", "부서장은 자기 부서 직원 권한만 배정할 수 있습니다.");
        }
        Long managerDeptId = manager.getDept() == null ? null : manager.getDept().getDeptId();
        Long empDeptId = emp.getDept() == null ? null : emp.getDept().getDeptId();
        if (managerDeptId == null || !managerDeptId.equals(empDeptId)) {
            throw BusinessException.forbidden("PDM_PERMISSION_MANAGER_DEPT_FORBIDDEN", "자기 부서 직원에게만 권한을 배정할 수 있습니다.");
        }
        if (!isWithinDepartmentPermissionScope(manager.getDept(), category, request)) {
            throw BusinessException.forbidden("PDM_PERMISSION_SCOPE_EXCEEDED", "부서에 허용된 권한 범위를 넘는 권한은 관리자 승인이 필요합니다.");
        }
    }

    private boolean isDepartmentManager(Emp emp) {
        if (emp == null || emp.getDept() == null) return false;
        return "MANAGER".equals(emp.getRoleCode()) || containsManagerTitle(emp.getJobTitle()) || containsManagerTitle(emp.getPositionName());
    }

    private boolean containsManagerTitle(String value) {
        return value != null && (value.contains("팀장") || value.contains("부서장"));
    }

    private boolean isWithinDepartmentPermissionScope(Dept dept, String category, PdmPermissionRequest request) {
        return (!request.canRegister() || hasDepartmentScopePermission(dept, category, "register"))
            && (!request.canRevise() || hasDepartmentScopePermission(dept, category, "revise"))
            && (!request.canView() || hasDepartmentScopePermission(dept, category, "view"))
            && (!request.canDownloadRequest() || hasDepartmentScopePermission(dept, category, "downloadRequest"))
            && (!request.canDownloadApprove() || hasDepartmentScopePermission(dept, category, "downloadApprove"));
    }

    private boolean hasDepartmentScopePermission(Dept dept, String category, String action) {
        return permissionRepository.findAll().stream()
            .filter(permission -> permission.getDept() != null && permission.getDept().getDeptId().equals(dept.getDeptId()))
            .filter(permission -> permission.getEmp() == null && permission.getDrawing() == null)
            .filter(permission -> category == null ? permission.getCategory() == null : permission.getCategory() == null || category.equals(permission.getCategory()))
            .anyMatch(permission -> allows(permission, action));
    }

    private boolean allows(PdmDrawingPermission permission, String action) {
        return switch (action) {
            case "register" -> "Y".equals(permission.getCanRegisterYn());
            case "revise" -> "Y".equals(permission.getCanReviseYn());
            case "view" -> "Y".equals(permission.getCanViewYn());
            case "downloadRequest" -> "Y".equals(permission.getCanDownloadRequestYn());
            case "downloadApprove" -> "Y".equals(permission.getCanDownloadApproveYn());
            default -> false;
        };
    }
}
