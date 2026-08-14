package com.kjh.groupware.domain.pdm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalDocumentRepository;
import com.kjh.groupware.domain.approval.ApprovalDraftService;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalResponse;
import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.domain.dept.DeptRepository;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.file.AttachFile;
import com.kjh.groupware.domain.file.AttachFileRepository;
import com.kjh.groupware.domain.file.FileService;
import com.kjh.groupware.domain.pdm.dto.PdmDownloadRequestCreateRequest;
import com.kjh.groupware.domain.pdm.dto.PdmDownloadRequestResponse;
import com.kjh.groupware.domain.pdm.dto.PdmDrawingDetailResponse;
import com.kjh.groupware.domain.pdm.dto.PdmDrawingResponse;
import com.kjh.groupware.domain.pdm.dto.PdmDuplicateCheckResponse;
import com.kjh.groupware.domain.pdm.dto.PdmFolderPathRenameRequest;
import com.kjh.groupware.domain.pdm.dto.PdmFolderPathRequest;
import com.kjh.groupware.domain.pdm.dto.PdmFolderMoveRequest;
import com.kjh.groupware.domain.pdm.dto.PdmFolderRequest;
import com.kjh.groupware.domain.pdm.dto.PdmFolderResponse;
import com.kjh.groupware.domain.pdm.dto.PdmPermissionAdminResponse;
import com.kjh.groupware.domain.pdm.dto.PdmPermissionRequest;
import com.kjh.groupware.domain.pdm.dto.PdmPermissionResponse;
import com.kjh.groupware.domain.pdm.dto.PdmRevisionResponse;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.response.PageResponse;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
class PdmFolderService {

    private final PdmDrawingRepository drawingRepository;
    private final PdmFolderRepository folderRepository;
    private final PdmPermissionPolicy permissionPolicy;
    private final CurrentEmpProvider currentEmpProvider;

    public List<PdmFolderResponse> folders() {
        ensureFolderRowsForDrawingPaths(currentEmpProvider.getCurrentEmp());
        return folderRepository.findAllByOrderByCategoryAscCompanyNameAscProjectNameAscBusinessUnitAscProcessNameAscFolderKindAscSortOrderAscFolderNameAsc().stream()
            .map(PdmFolderResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public PdmFolderResponse createFolder(PdmFolderRequest request) {
        Emp current = currentEmpProvider.getCurrentEmp();
        String category = requireCategory(request.category());
        permissionPolicy.assertCanRegister(current, category, null);
        PdmFolder folder = PdmFolder.builder()
            .category(category)
            .companyName(blankToNull(request.companyName()))
            .projectName(blankToNull(request.projectName()))
            .businessUnit(blankToNull(request.businessUnit()))
            .processName(blankToNull(request.processName()))
            .folderKind(requireText(request.folderKind(), "PDM_FOLDER_KIND_REQUIRED", "폴더 구분을 입력해 주세요."))
            .folderName(requireText(request.folderName(), "PDM_FOLDER_NAME_REQUIRED", "폴더명을 입력해 주세요."))
            .sortOrder(nextFolderSortOrder(category, request))
            .createdBy(current)
            .build();
        return PdmFolderResponse.from(folderRepository.save(folder));
    }

    @Transactional
    public List<PdmFolderResponse> moveFolder(Long folderId, PdmFolderMoveRequest request) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PdmFolder folder = folderRepository.findById(folderId)
            .orElseThrow(() -> BusinessException.notFound("PDM_FOLDER_NOT_FOUND", "폴더를 찾을 수 없습니다."));
        permissionPolicy.assertCanRegister(current, folder.getCategory(), null);
        String direction = requireText(request.direction(), "PDM_FOLDER_MOVE_DIRECTION_REQUIRED", "이동 방향을 입력해 주세요.").toUpperCase();
        int delta = switch (direction) {
            case "UP" -> -1;
            case "DOWN" -> 1;
            default -> throw BusinessException.badRequest("PDM_FOLDER_MOVE_DIRECTION_INVALID", "지원하지 않는 이동 방향입니다.");
        };
        List<PdmFolder> siblings = folderRepository.findAll().stream()
            .filter(candidate -> sameFolderOrderScope(folder, candidate))
            .sorted(folderOrderComparator())
            .toList();
        int index = siblings.indexOf(folder);
        int targetIndex = index + delta;
        if (index < 0 || targetIndex < 0 || targetIndex >= siblings.size()) {
            return folders();
        }
        PdmFolder target = siblings.get(targetIndex);
        int currentOrder = safeSortOrder(folder);
        folder.updateSortOrder(safeSortOrder(target));
        target.updateSortOrder(currentOrder);
        return folders();
    }

    @Transactional
    public PdmFolderResponse renameFolder(Long folderId, PdmFolderRequest request) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PdmFolder folder = folderRepository.findById(folderId)
            .orElseThrow(() -> BusinessException.notFound("PDM_FOLDER_NOT_FOUND", "폴더를 찾을 수 없습니다."));
        permissionPolicy.assertCanRegister(current, folder.getCategory(), null);
        List<PdmFolderResponse> updated = renameFolderPath(new PdmFolderPathRenameRequest(
            folder.getCategory(),
            folder.getFolderKind(),
            folder.getFolderName(),
            request.folderName(),
            folder.getCompanyName(),
            folder.getProjectName(),
            folder.getBusinessUnit(),
            folder.getProcessName()
        ));
        return updated.stream()
            .filter(item -> item.folderId().equals(folderId))
            .findFirst()
            .orElseGet(() -> PdmFolderResponse.from(folder));
    }

    @Transactional
    public List<PdmFolderResponse> renameFolderPath(PdmFolderPathRenameRequest request) {
        Emp current = currentEmpProvider.getCurrentEmp();
        String category = requireCategory(request.category());
        String folderKind = requireText(request.folderKind(), "PDM_FOLDER_KIND_REQUIRED", "폴더 구분을 입력해 주세요.").toUpperCase();
        String oldName = requireText(request.folderName(), "PDM_FOLDER_NAME_REQUIRED", "폴더명을 입력해 주세요.");
        String newName = requireText(request.newFolderName(), "PDM_FOLDER_NAME_REQUIRED", "폴더명을 입력해 주세요.");
        permissionPolicy.assertCanRegister(current, category, null);

        int changed = 0;
        for (PdmFolder folder : folderRepository.findAll()) {
            if (!folderInRenameScope(folder, category, folderKind, oldName, request)) {
                continue;
            }
            renameFolderInScope(folder, folderKind, oldName, newName);
            changed++;
        }
        for (PdmDrawing drawing : drawingRepository.findAll()) {
            if (!drawingInPath(drawing, category, folderKind, oldName, request)) {
                continue;
            }
            renameDrawingInScope(drawing, folderKind, oldName, newName);
            changed++;
        }
        if (changed == 0) {
            throw BusinessException.notFound("PDM_FOLDER_PATH_NOT_FOUND", "수정할 폴더 경로를 찾을 수 없습니다.");
        }
        return folders();
    }

    @Transactional
    public List<PdmFolderResponse> deleteFolderPath(PdmFolderPathRequest request) {
        Emp current = currentEmpProvider.getCurrentEmp();
        String category = requireCategory(request.category());
        String folderKind = requireText(request.folderKind(), "PDM_FOLDER_KIND_REQUIRED", "폴더 구분을 입력해 주세요.").toUpperCase();
        String folderName = requireText(request.folderName(), "PDM_FOLDER_NAME_REQUIRED", "폴더명을 입력해 주세요.");
        permissionPolicy.assertCanRegister(current, category, null);

        long drawingCount = drawingRepository.findAll().stream()
            .filter(drawing -> drawingInPath(drawing, category, folderKind, folderName, request))
            .count();
        if (drawingCount > 0) {
            throw BusinessException.badRequest("PDM_FOLDER_NOT_EMPTY", "도면이 들어 있는 폴더는 삭제할 수 없습니다. 도면을 먼저 이동하거나 정리해 주세요.");
        }
        List<PdmFolder> targets = folderRepository.findAll().stream()
            .filter(folder -> folderInDeleteScope(folder, category, folderKind, folderName, request))
            .toList();
        if (targets.isEmpty()) {
            throw BusinessException.notFound("PDM_FOLDER_PATH_NOT_FOUND", "삭제할 폴더 경로를 찾을 수 없습니다.");
        }
        folderRepository.deleteAll(targets);
        return folders();
    }

    @Transactional(readOnly = true)
    private String requireCategory(String category) {
        String normalized = requireText(category, "PDM_CATEGORY_REQUIRED", "도면 구분을 선택해 주세요.").toUpperCase();
        if (!PdmDrawing.CATEGORY_PRODUCT.equals(normalized) && !PdmDrawing.CATEGORY_EQUIPMENT.equals(normalized)) {
            throw BusinessException.badRequest("PDM_CATEGORY_INVALID", "도면 구분이 올바르지 않습니다.");
        }
        return normalized;
    }

    private String requireStatus(String status) {
        String normalized = requireText(status, "PDM_STATUS_REQUIRED", "도면 상태를 선택해 주세요.").toUpperCase();
        if (!List.of(
            PdmDrawing.STATUS_ACTIVE,
            PdmDrawing.STATUS_OLD_VERSION,
            PdmDrawing.STATUS_VOIDED,
            PdmDrawing.STATUS_ON_HOLD
        ).contains(normalized)) {
            throw BusinessException.badRequest("PDM_STATUS_INVALID", "도면 상태가 올바르지 않습니다.");
        }
        return normalized;
    }

    private boolean folderInRenameScope(PdmFolder folder, String category, String folderKind, String folderName, PdmFolderPathRenameRequest request) {
        return folderInPath(folder, category, folderKind, folderName, request.companyName(), request.businessUnit(), request.processName());
    }

    private boolean folderInDeleteScope(PdmFolder folder, String category, String folderKind, String folderName, PdmFolderPathRequest request) {
        return folderInPath(folder, category, folderKind, folderName, request.companyName(), request.businessUnit(), request.processName());
    }

    private int nextFolderSortOrder(String category, PdmFolderRequest request) {
        PdmFolder probe = PdmFolder.builder()
            .category(category)
            .companyName(blankToNull(request.companyName()))
            .projectName(blankToNull(request.projectName()))
            .businessUnit(blankToNull(request.businessUnit()))
            .processName(blankToNull(request.processName()))
            .folderKind(requireText(request.folderKind(), "PDM_FOLDER_KIND_REQUIRED", "폴더 구분을 입력해 주세요."))
            .folderName(requireText(request.folderName(), "PDM_FOLDER_NAME_REQUIRED", "폴더명을 입력해 주세요."))
            .sortOrder(0)
            .createdBy(currentEmpProvider.getCurrentEmp())
            .build();
        return folderRepository.findAll().stream()
            .filter(folder -> sameFolderOrderScope(probe, folder))
            .map(PdmFolder::getSortOrder)
            .filter(Objects::nonNull)
            .max(Integer::compareTo)
            .map(order -> order + 10)
            .orElse(10);
    }

    private void ensureFolderRowsForDrawingPaths(Emp current) {
        Map<String, PdmFolder> existing = new LinkedHashMap<>();
        for (PdmFolder folder : folderRepository.findAll()) {
            existing.put(folderKey(folder.getCategory(), folder.getCompanyName(), folder.getProjectName(), folder.getBusinessUnit(), folder.getProcessName(), folder.getFolderKind(), folder.getFolderName()), folder);
        }
        for (PdmDrawing drawing : drawingRepository.findAll()) {
            if (PdmDrawing.CATEGORY_PRODUCT.equals(drawing.getCategory())) {
                String company = blankToNull(drawing.getCompanyName());
                String project = blankToNull(drawing.getProjectName());
                if (project == null) {
                    project = blankToNull(drawing.getGroupName());
                }
                if (company != null) {
                    ensureFolderRow(existing, current, PdmDrawing.CATEGORY_PRODUCT, null, null, null, null, "COMPANY", company);
                    if (project != null) {
                        ensureFolderRow(existing, current, PdmDrawing.CATEGORY_PRODUCT, company, project, null, null, "PROJECT", project);
                    }
                }
                continue;
            }
            String business = blankToNull(drawing.getBusinessUnit());
            String process = blankToNull(drawing.getProcessName());
            String equipment = blankToNull(drawing.getEquipmentName());
            String group = blankToNull(drawing.getGroupName());
            if (business != null) {
                ensureFolderRow(existing, current, PdmDrawing.CATEGORY_EQUIPMENT, null, null, null, null, "BUSINESS", business);
                if (process != null) {
                    ensureFolderRow(existing, current, PdmDrawing.CATEGORY_EQUIPMENT, null, null, business, null, "PROCESS", process);
                    if (equipment != null) {
                        ensureFolderRow(existing, current, PdmDrawing.CATEGORY_EQUIPMENT, null, null, business, process, "EQUIPMENT", equipment);
                    } else if (group != null) {
                        ensureFolderRow(existing, current, PdmDrawing.CATEGORY_EQUIPMENT, null, null, business, process, "COMMON", group);
                    }
                }
            }
        }
    }

    private void ensureFolderRow(
        Map<String, PdmFolder> existing,
        Emp current,
        String category,
        String companyName,
        String projectName,
        String businessUnit,
        String processName,
        String folderKind,
        String folderName
    ) {
        String key = folderKey(category, companyName, projectName, businessUnit, processName, folderKind, folderName);
        if (existing.containsKey(key)) {
            return;
        }
        PdmFolderRequest request = new PdmFolderRequest(category, companyName, projectName, businessUnit, processName, folderKind, folderName);
        PdmFolder saved = folderRepository.save(PdmFolder.builder()
            .category(category)
            .companyName(blankToNull(companyName))
            .projectName(blankToNull(projectName))
            .businessUnit(blankToNull(businessUnit))
            .processName(blankToNull(processName))
            .folderKind(folderKind)
            .folderName(folderName)
            .sortOrder(nextFolderSortOrder(category, request))
            .createdBy(current)
            .build());
        existing.put(key, saved);
    }

    private String folderKey(String category, String companyName, String projectName, String businessUnit, String processName, String folderKind, String folderName) {
        String normalizedCategory = Objects.toString(blankToNull(category), "");
        String normalizedKind = Objects.toString(blankToNull(folderKind), "");
        String normalizedName = Objects.toString(blankToNull(folderName), "");
        if (PdmDrawing.CATEGORY_PRODUCT.equals(normalizedCategory)) {
            if ("COMPANY".equals(normalizedKind)) {
                return String.join("|", normalizedCategory, normalizedKind, normalizedName);
            }
            if ("PROJECT".equals(normalizedKind)) {
                return String.join("|", normalizedCategory, normalizedKind, Objects.toString(blankToNull(companyName), ""), normalizedName);
            }
        }
        if ("BUSINESS".equals(normalizedKind)) {
            return String.join("|", normalizedCategory, normalizedKind, normalizedName);
        }
        if ("PROCESS".equals(normalizedKind)) {
            return String.join("|", normalizedCategory, normalizedKind, Objects.toString(blankToNull(businessUnit), ""), normalizedName);
        }
        if ("COMMON".equals(normalizedKind) || "EQUIPMENT".equals(normalizedKind)) {
            return String.join("|", normalizedCategory, normalizedKind, Objects.toString(blankToNull(businessUnit), ""), Objects.toString(blankToNull(processName), ""), normalizedName);
        }
        return String.join("|",
            normalizedCategory,
            Objects.toString(blankToNull(companyName), ""),
            Objects.toString(blankToNull(projectName), ""),
            Objects.toString(blankToNull(businessUnit), ""),
            Objects.toString(blankToNull(processName), ""),
            normalizedKind,
            normalizedName
        );
    }

    private boolean sameFolderOrderScope(PdmFolder left, PdmFolder right) {
        if (left == null || right == null) {
            return false;
        }
        if (!safeEquals(left.getCategory(), right.getCategory())) {
            return false;
        }
        String leftKind = left.getFolderKind();
        String rightKind = right.getFolderKind();
        if (PdmDrawing.CATEGORY_PRODUCT.equals(left.getCategory())) {
            if (!safeEquals(leftKind, rightKind)) {
                return false;
            }
            return switch (leftKind) {
                case "COMPANY" -> true;
                case "PROJECT" -> safeEquals(left.getCompanyName(), right.getCompanyName());
                default -> false;
            };
        }
        if ("BUSINESS".equals(leftKind) || "PROCESS".equals(leftKind)) {
            if (!safeEquals(leftKind, rightKind)) {
                return false;
            }
            return "BUSINESS".equals(leftKind)
                || safeEquals(left.getBusinessUnit(), right.getBusinessUnit());
        }
        if ("COMMON".equals(leftKind) || "EQUIPMENT".equals(leftKind)) {
            return ("COMMON".equals(rightKind) || "EQUIPMENT".equals(rightKind))
                && safeEquals(left.getBusinessUnit(), right.getBusinessUnit())
                && safeEquals(left.getProcessName(), right.getProcessName());
        }
        return false;
    }

    private Comparator<PdmFolder> folderOrderComparator() {
        return Comparator.comparingInt(this::safeSortOrder)
            .thenComparing(PdmFolder::getFolderName, Comparator.nullsLast(String::compareToIgnoreCase))
            .thenComparing(PdmFolder::getFolderId, Comparator.nullsLast(Long::compareTo));
    }

    private int safeSortOrder(PdmFolder folder) {
        return folder.getSortOrder() == null ? 0 : folder.getSortOrder();
    }

    private boolean folderInPath(PdmFolder folder, String category, String folderKind, String folderName, String companyName, String businessUnit, String processName) {
        if (!category.equals(folder.getCategory())) {
            return false;
        }
        return switch (folderKind) {
            case "COMPANY" -> PdmDrawing.CATEGORY_PRODUCT.equals(category)
                && (("COMPANY".equals(folder.getFolderKind()) && folderName.equals(folder.getFolderName())) || folderName.equals(folder.getCompanyName()));
            case "PROJECT" -> PdmDrawing.CATEGORY_PRODUCT.equals(category)
                && safeEquals(blankToNull(companyName), folder.getCompanyName())
                && (("PROJECT".equals(folder.getFolderKind()) && folderName.equals(folder.getFolderName())) || folderName.equals(folder.getProjectName()));
            case "BUSINESS" -> PdmDrawing.CATEGORY_EQUIPMENT.equals(category)
                && (("BUSINESS".equals(folder.getFolderKind()) && folderName.equals(folder.getFolderName())) || folderName.equals(folder.getBusinessUnit()));
            case "PROCESS" -> PdmDrawing.CATEGORY_EQUIPMENT.equals(category)
                && safeEquals(blankToNull(businessUnit), folder.getBusinessUnit())
                && (("PROCESS".equals(folder.getFolderKind()) && folderName.equals(folder.getFolderName())) || folderName.equals(folder.getProcessName()));
            case "COMMON", "EQUIPMENT" -> PdmDrawing.CATEGORY_EQUIPMENT.equals(category)
                && folderKind.equals(folder.getFolderKind())
                && safeEquals(blankToNull(businessUnit), folder.getBusinessUnit())
                && safeEquals(blankToNull(processName), folder.getProcessName())
                && folderName.equals(folder.getFolderName());
            default -> false;
        };
    }

    private boolean drawingInPath(PdmDrawing drawing, String category, String folderKind, String folderName, PdmFolderPathRenameRequest request) {
        return drawingInPath(drawing, category, folderKind, folderName, request.companyName(), request.businessUnit(), request.processName());
    }

    private boolean drawingInPath(PdmDrawing drawing, String category, String folderKind, String folderName, PdmFolderPathRequest request) {
        return drawingInPath(drawing, category, folderKind, folderName, request.companyName(), request.businessUnit(), request.processName());
    }

    private boolean drawingInPath(PdmDrawing drawing, String category, String folderKind, String folderName, String companyName, String businessUnit, String processName) {
        if (!category.equals(drawing.getCategory())) {
            return false;
        }
        return switch (folderKind) {
            case "COMPANY" -> PdmDrawing.CATEGORY_PRODUCT.equals(category) && folderName.equals(drawing.getCompanyName());
            case "PROJECT" -> PdmDrawing.CATEGORY_PRODUCT.equals(category)
                && safeEquals(blankToNull(companyName), drawing.getCompanyName())
                && (folderName.equals(drawing.getProjectName()) || (drawing.getProjectName() == null && folderName.equals(drawing.getGroupName())));
            case "BUSINESS" -> PdmDrawing.CATEGORY_EQUIPMENT.equals(category) && folderName.equals(drawing.getBusinessUnit());
            case "PROCESS" -> PdmDrawing.CATEGORY_EQUIPMENT.equals(category)
                && safeEquals(blankToNull(businessUnit), drawing.getBusinessUnit())
                && folderName.equals(drawing.getProcessName());
            case "COMMON" -> PdmDrawing.CATEGORY_EQUIPMENT.equals(category)
                && safeEquals(blankToNull(businessUnit), drawing.getBusinessUnit())
                && safeEquals(blankToNull(processName), drawing.getProcessName())
                && folderName.equals(drawing.getGroupName());
            case "EQUIPMENT" -> PdmDrawing.CATEGORY_EQUIPMENT.equals(category)
                && safeEquals(blankToNull(businessUnit), drawing.getBusinessUnit())
                && safeEquals(blankToNull(processName), drawing.getProcessName())
                && folderName.equals(drawing.getEquipmentName());
            default -> false;
        };
    }

    private void renameFolderInScope(PdmFolder folder, String folderKind, String oldName, String newName) {
        switch (folderKind) {
            case "COMPANY" -> folder.renameCompany(oldName, newName);
            case "PROJECT" -> folder.renameProject(oldName, newName);
            case "BUSINESS" -> folder.renameBusinessUnit(oldName, newName);
            case "PROCESS" -> folder.renameProcess(oldName, newName);
            case "COMMON", "EQUIPMENT" -> folder.rename(newName);
            default -> throw BusinessException.badRequest("PDM_FOLDER_KIND_INVALID", "폴더 구분이 올바르지 않습니다.");
        }
    }

    private void renameDrawingInScope(PdmDrawing drawing, String folderKind, String oldName, String newName) {
        switch (folderKind) {
            case "COMPANY" -> drawing.renameCompany(oldName, newName);
            case "PROJECT" -> drawing.renameProject(oldName, newName);
            case "BUSINESS" -> drawing.renameBusinessUnit(oldName, newName);
            case "PROCESS" -> drawing.renameProcess(oldName, newName);
            case "COMMON" -> drawing.renameGroup(oldName, newName);
            case "EQUIPMENT" -> drawing.renameEquipment(oldName, newName);
            default -> throw BusinessException.badRequest("PDM_FOLDER_KIND_INVALID", "폴더 구분이 올바르지 않습니다.");
        }
    }

    private boolean safeEquals(String left, String right) {
        if (left == null) {
            return right == null;
        }
        return left.equals(right);
    }

    private String requireText(String value, String code, String message) {
        if (!hasText(value)) {
            throw BusinessException.badRequest(code, message);
        }
        return value.trim();
    }

    private String blankToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

}
