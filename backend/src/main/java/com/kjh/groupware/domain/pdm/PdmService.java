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
public class PdmService {

    private final PdmDrawingRepository drawingRepository;
    private final PdmDrawingRevisionRepository revisionRepository;
    private final PdmFolderRepository folderRepository;
    private final PdmDrawingPermissionRepository permissionRepository;
    private final PdmDownloadRequestRepository downloadRequestRepository;
    private final PdmDownloadLogRepository downloadLogRepository;
    private final ApprovalDocumentRepository approvalDocumentRepository;
    private final DeptRepository deptRepository;
    private final EmpRepository empRepository;
    private final AttachFileRepository attachFileRepository;
    private final FileService fileService;
    private final ApprovalDraftService approvalDraftService;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public PageResponse<PdmDrawingResponse> drawings(String category, String keyword, int page, int size) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PageRequest pageRequest = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(Sort.Order.desc("drawingId")));
        Page<PdmDrawing> found = drawingRepository.search(blankToNull(category), hasText(keyword) ? keyword.trim() : "", pageRequest);
        return new PageResponse<>(
            found.getContent().stream()
                .filter(drawing -> canView(current, drawing))
                .map(PdmDrawingResponse::from)
                .toList(),
            found.getNumber(),
            found.getSize(),
            found.getTotalElements(),
            found.getTotalPages()
        );
    }

    @Transactional(readOnly = true)
    public PdmDrawingDetailResponse detail(Long drawingId) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PdmDrawing drawing = drawing(drawingId);
        assertCanView(current, drawing);
        return new PdmDrawingDetailResponse(
            PdmDrawingResponse.from(drawing),
            revisionRepository.findByDrawingOrderByRevisionOrderDescRevisionIdDesc(drawing).stream()
                .filter(revision -> !"Y".equals(revision.getVoidYn()))
                .map(PdmRevisionResponse::from)
                .toList(),
            permissions(current, drawing)
        );
    }

    @Transactional(readOnly = true)
    public List<PdmFolderResponse> folders() {
        return folderRepository.findAllByOrderByCategoryAscCompanyNameAscProjectNameAscBusinessUnitAscProcessNameAscFolderKindAscSortOrderAscFolderNameAsc().stream()
            .map(PdmFolderResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public PdmPermissionResponse effectivePermission(String category, Long drawingId) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PdmDrawing drawing = drawingId == null ? null : drawing(drawingId);
        String normalizedCategory = drawing != null ? drawing.getCategory() : (hasText(category) ? requireCategory(category) : null);
        boolean admin = isAdmin(current);
        boolean register = admin || (normalizedCategory != null && hasPermission(current, normalizedCategory, drawing, "register"));
        boolean revise = admin || (drawing != null && hasPermission(current, drawing, "revise"));
        boolean view = admin || (drawing != null ? canView(current, drawing) : normalizedCategory != null && hasPermission(current, normalizedCategory, null, "view"));
        boolean requestDownload = admin || (drawing != null && hasPermission(current, drawing, "downloadRequest"));
        boolean approveDownload = admin || (drawing != null && hasPermission(current, drawing, "downloadApprove"));
        return new PdmPermissionResponse(admin, register, revise, view, requestDownload, approveDownload);
    }

    @Transactional
    public PdmFolderResponse createFolder(PdmFolderRequest request) {
        Emp current = currentEmpProvider.getCurrentEmp();
        String category = requireCategory(request.category());
        assertCanRegister(current, category, null);
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
        assertCanRegister(current, folder.getCategory(), null);
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
        assertCanRegister(current, folder.getCategory(), null);
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
        assertCanRegister(current, category, null);

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
        assertCanRegister(current, category, null);

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
    public PdmDuplicateCheckResponse duplicate(String drawingNo) {
        if (!hasText(drawingNo)) {
            return new PdmDuplicateCheckResponse(false, null, null, null, null);
        }
        return drawingRepository.findByDrawingNoIgnoreCase(drawingNo.trim())
            .map(drawing -> new PdmDuplicateCheckResponse(
                true,
                drawing.getDrawingId(),
                drawing.getDrawingNo(),
                drawing.getTitle(),
                "이미 등록된 도면번호입니다. 새 리비전으로 등록하거나 업로드를 취소하세요."
            ))
            .orElseGet(() -> new PdmDuplicateCheckResponse(false, null, drawingNo.trim(), null, null));
    }

    @Transactional
    public PdmDrawingDetailResponse uploadNewDrawing(
        String category,
        String drawingNo,
        String title,
        String companyName,
        String projectName,
        String businessUnit,
        String processName,
        String equipmentName,
        String groupName,
        String status,
        String description,
        String revisionLabel,
        Integer revisionOrder,
        LocalDate revisionDate,
        LocalDate receivedDate,
        String changeNote,
        MultipartFile file,
        String ipAddress,
        String userAgent
    ) {
        Emp current = currentEmpProvider.getCurrentEmp();
        String normalizedCategory = requireCategory(category);
        assertCanRegister(current, normalizedCategory, null);
        String normalizedDrawingNo = requireText(drawingNo, "DRAWING_NO_REQUIRED", "도면번호를 입력해 주세요.");
        if (drawingRepository.existsByDrawingNoIgnoreCase(normalizedDrawingNo)) {
            throw BusinessException.badRequest("PDM_DRAWING_NO_DUPLICATED", "이미 등록된 도면번호입니다. 새 리비전으로 등록하세요.");
        }
        PdmDrawing drawing = drawingRepository.save(PdmDrawing.builder()
            .category(normalizedCategory)
            .drawingNo(normalizedDrawingNo)
            .title(requireText(title, "DRAWING_TITLE_REQUIRED", "도면명을 입력해 주세요."))
            .companyName(blankToNull(companyName))
            .projectName(blankToNull(projectName))
            .businessUnit(blankToNull(businessUnit))
            .processName(blankToNull(processName))
            .equipmentName(blankToNull(equipmentName))
            .groupName(blankToNull(groupName))
            .status(blankToNull(status))
            .description(blankToNull(description))
            .createdBy(current)
            .build());
        PdmDrawingRevision revision = createRevision(drawing, revisionLabel, revisionOrder, revisionDate, receivedDate, changeNote, current);
        attachFile(revision, file, ipAddress, userAgent);
        markLatest(drawing);
        return detail(drawing.getDrawingId());
    }

    @Transactional
    public PdmDrawingDetailResponse addRevision(
        Long drawingId,
        String revisionLabel,
        Integer revisionOrder,
        LocalDate revisionDate,
        LocalDate receivedDate,
        String changeNote,
        MultipartFile file,
        String ipAddress,
        String userAgent
    ) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PdmDrawing drawing = drawing(drawingId);
        assertCanRevise(current, drawing);
        PdmDrawingRevision revision = createRevision(drawing, revisionLabel, revisionOrder, revisionDate, receivedDate, changeNote, current);
        attachFile(revision, file, ipAddress, userAgent);
        markLatest(drawing);
        return detail(drawing.getDrawingId());
    }

    @Transactional
    public PdmDrawingDetailResponse voidDrawing(Long drawingId, String ipAddress, String userAgent) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PdmDrawing drawing = drawing(drawingId);
        assertCanRevise(current, drawing);
        drawing.voidDrawing();
        auditLogService.record(current.getEmpId(), AuditActionType.UPDATE, "pdm_drawing", drawing.getDrawingId(), ipAddress, userAgent);
        return detail(drawing.getDrawingId());
    }

    @Transactional
    public PdmDrawingDetailResponse updateDrawingStatus(Long drawingId, String status, String ipAddress, String userAgent) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PdmDrawing drawing = drawing(drawingId);
        assertCanRevise(current, drawing);
        drawing.changeStatus(requireStatus(status));
        auditLogService.record(current.getEmpId(), AuditActionType.UPDATE, "pdm_drawing", drawing.getDrawingId(), ipAddress, userAgent);
        return detail(drawing.getDrawingId());
    }

    @Transactional
    public PdmDrawingDetailResponse deleteRevision(Long revisionId, String ipAddress, String userAgent) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PdmDrawingRevision revision = revision(revisionId);
        PdmDrawing drawing = revision.getDrawing();
        assertCanRevise(current, drawing);
        if ("Y".equals(revision.getVoidYn())) {
            throw BusinessException.badRequest("PDM_REVISION_ALREADY_DELETED", "이미 삭제된 리비전입니다.");
        }
        boolean hadDownloadRequests = downloadRequestRepository.existsByRevision(revision);
        revision.voidRevision();
        AttachFile file = revision.getFile();
        if (file != null && !"Y".equals(file.getDeletedYn())) {
            file.delete(current);
            auditLogService.record(current.getEmpId(), AuditActionType.DELETE, "attach_file", file.getFileId(), ipAddress, userAgent);
        }
        markLatest(drawing);
        if (drawing.getCurrentRevision() == null) {
            drawing.voidDrawing();
        }
        auditLogService.record(
            current.getEmpId(),
            AuditActionType.DELETE,
            "pdm_drawing_revision",
            revision.getRevisionId(),
            null,
            null,
            ipAddress,
            userAgent,
            hadDownloadRequests ? "다운로드 요청 이력이 있는 리비전 논리 삭제" : "리비전 논리 삭제",
            true
        );
        return detail(drawing.getDrawingId());
    }

    @Transactional
    public PdmDownloadRequestResponse requestDownload(Long revisionId, PdmDownloadRequestCreateRequest request, String ipAddress, String userAgent) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PdmDrawingRevision revision = revision(revisionId);
        PdmDrawing drawing = revision.getDrawing();
        assertCanRequestDownload(current, drawing);
        assertRevisionUsable(revision, "PDM_REVISION_DELETED", "삭제된 리비전은 다운로드 요청할 수 없습니다.");
        assertDrawingNotVoided(drawing);
        if (revision.getFile() == null) {
            throw BusinessException.badRequest("PDM_REVISION_FILE_MISSING", "도면 파일이 없습니다.");
        }
        ApprovalResponse approval = approvalDraftService.create(new ApprovalRequest(
            "[도면 다운로드] " + drawing.getDrawingNo(),
            downloadApprovalContent(drawing, revision, request.reason()),
            PdmConstants.TEMPLATE_DOWNLOAD,
            downloadFormData(drawing, revision, request.reason()),
            "NORMAL",
            List.of(),
            request.approverEmpIds(),
            List.of(),
            List.of(),
            List.of(),
            false
        ), ipAddress, userAgent);
        ApprovalDocument approvalDocument = approvalDocumentRepository.findById(approval.approvalId())
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "전자결재 문서를 찾을 수 없습니다."));
        PdmDownloadRequest saved = downloadRequestRepository.save(PdmDownloadRequest.builder()
            .drawing(drawing)
            .revision(revision)
            .requester(current)
            .approval(approvalDocument)
            .reason(request.reason())
            .build());
        return PdmDownloadRequestResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<PdmDownloadRequestResponse> myDownloadRequests() {
        Emp current = currentEmpProvider.getCurrentEmp();
        return downloadRequestRepository.findByRequesterOrderByRequestIdDesc(current).stream()
            .map(PdmDownloadRequestResponse::from)
            .toList();
    }

    @Transactional
    public DownloadResource download(Long requestId, String ipAddress, String userAgent) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PdmDownloadRequest request = downloadRequestRepository.findById(requestId)
            .orElseThrow(() -> BusinessException.notFound("PDM_DOWNLOAD_REQUEST_NOT_FOUND", "다운로드 요청을 찾을 수 없습니다."));
        if (!request.getRequester().getEmpId().equals(current.getEmpId()) && !isAdmin(current)) {
            throw BusinessException.forbidden("PDM_DOWNLOAD_REQUEST_FORBIDDEN", "본인의 다운로드 요청만 사용할 수 있습니다.");
        }
        if (!ApprovalDocument.STATUS_APPROVED.equals(request.getApproval().getStatus())) {
            throw BusinessException.badRequest("PDM_DOWNLOAD_NOT_APPROVED", "다운로드 결재가 승인되지 않았습니다.");
        }
        assertRevisionUsable(request.getRevision(), "PDM_REVISION_DELETED", "삭제된 리비전은 다운로드할 수 없습니다.");
        assertDrawingNotVoided(request.getDrawing());
        LocalDateTime approvedUntil = request.approvedUntil();
        if (approvedUntil == null || LocalDateTime.now().isAfter(approvedUntil)) {
            throw BusinessException.badRequest("PDM_DOWNLOAD_EXPIRED", "다운로드 승인 유효기간이 만료되었습니다.");
        }
        AttachFile file = request.getRevision().getFile();
        if (file == null || "Y".equals(file.getDeletedYn())) {
            throw BusinessException.notFound("PDM_FILE_NOT_FOUND", "도면 파일을 찾을 수 없습니다.");
        }
        if (isPdfFile(file) && !fileService.hasPdfHeader(file)) {
            throw BusinessException.badRequest("PDM_DOWNLOAD_INVALID_PDF", "PDF 파일이 손상되었거나 실제 PDF 형식이 아닙니다.");
        }
        request.refreshExpiresAtFromApproval();
        downloadLogRepository.save(PdmDownloadLog.builder()
            .request(request)
            .file(file)
            .downloadedBy(current)
            .ipAddress(ipAddress)
            .userAgent(userAgent)
            .build());
        return new DownloadResource(file, fileService.loadResource(file));
    }

    @Transactional(readOnly = true)
    public DownloadResource preview(Long revisionId) {
        Emp current = currentEmpProvider.getCurrentEmp();
        PdmDrawingRevision revision = revision(revisionId);
        PdmDrawing drawing = revision.getDrawing();
        assertCanView(current, drawing);
        assertRevisionUsable(revision, "PDM_REVISION_DELETED", "삭제된 리비전은 열람할 수 없습니다.");
        AttachFile file = revision.getFile();
        if (file == null || "Y".equals(file.getDeletedYn())) {
            throw BusinessException.notFound("PDM_FILE_NOT_FOUND", "도면 파일을 찾을 수 없습니다.");
        }
        String fileName = file.getOriginalFileName() == null ? "" : file.getOriginalFileName().toLowerCase();
        if (!isPdfFile(file)) {
            throw BusinessException.badRequest("PDM_PREVIEW_UNSUPPORTED", "PDF 파일만 미리보기를 지원합니다.");
        }
        if (!fileService.hasPdfHeader(file)) {
            throw BusinessException.badRequest("PDM_PREVIEW_INVALID_PDF", "PDF 파일이 손상되었거나 실제 PDF 형식이 아닙니다.");
        }
        return new DownloadResource(file, fileService.loadResource(file));
    }

    private boolean isPdfFile(AttachFile file) {
        String fileExt = file.getFileExt() == null ? "" : file.getFileExt().toLowerCase();
        String fileName = file.getOriginalFileName() == null ? "" : file.getOriginalFileName().toLowerCase();
        String mimeType = file.getMimeType() == null ? "" : file.getMimeType().toLowerCase();
        return "pdf".equals(fileExt) || fileName.endsWith(".pdf") || mimeType.contains("pdf");
    }

    @Transactional(readOnly = true)
    public List<PdmPermissionAdminResponse> permissions() {
        Emp current = currentEmpProvider.getCurrentEmp();
        assertCanManagePermissions(current);
        Map<String, PdmDrawingPermission> latestByTarget = new LinkedHashMap<>();
        permissionRepository.findAll(Sort.by(Sort.Order.desc("permissionId"))).stream()
            .filter(permission -> isAdmin(current) || canManagerViewPermission(current, permission))
            .forEach(permission -> latestByTarget.putIfAbsent(permissionTargetKey(permission), permission));
        return latestByTarget.values().stream()
            .map(PdmPermissionAdminResponse::from)
            .toList();
    }

    @Transactional
    public PdmPermissionAdminResponse savePermission(PdmPermissionRequest request) {
        Emp current = currentEmpProvider.getCurrentEmp();
        assertCanManagePermissions(current);
        PdmDrawing drawing = request.drawingId() == null ? null : drawing(request.drawingId());
        Dept dept = request.deptId() == null ? null : deptRepository.findById(request.deptId())
            .orElseThrow(() -> BusinessException.notFound("DEPT_NOT_FOUND", "부서를 찾을 수 없습니다."));
        Emp emp = request.empId() == null ? null : empRepository.findById(request.empId())
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "사용자를 찾을 수 없습니다."));
        if (dept == null && emp == null) {
            throw BusinessException.badRequest("PDM_PERMISSION_TARGET_REQUIRED", "권한 대상 사용자 또는 부서를 선택해 주세요.");
        }
        String category = blankToNull(request.category());
        if (!isAdmin(current)) {
            assertManagerCanAssignPermission(current, category, drawing, dept, emp, request);
        }
        PdmDrawingPermission permission;
        if (request.permissionId() == null) {
            List<PdmDrawingPermission> sameTargets = permissionRepository.findSameTarget(category, drawing, dept, emp);
            permission = sameTargets.isEmpty() ? PdmDrawingPermission.builder().build() : sameTargets.get(0);
            if (sameTargets.size() > 1) {
                permissionRepository.deleteAll(sameTargets.subList(1, sameTargets.size()));
            }
        } else {
            permission = permissionRepository.findById(request.permissionId())
                .orElseThrow(() -> BusinessException.notFound("PDM_PERMISSION_NOT_FOUND", "도면 권한을 찾을 수 없습니다."));
            if (!isAdmin(current) && (!canManagerViewPermission(current, permission) || permission.getEmp() == null)) {
                throw BusinessException.forbidden("PDM_PERMISSION_MANAGER_TARGET_FORBIDDEN", "부서장은 자기 부서 직원 권한만 수정할 수 있습니다.");
            }
        }
        permission.update(
            category,
            drawing,
            dept,
            emp,
            request.canRegister(),
            request.canRevise(),
            request.canView(),
            request.canDownloadRequest(),
            request.canDownloadApprove()
        );
        return PdmPermissionAdminResponse.from(permissionRepository.save(permission));
    }

    private String permissionTargetKey(PdmDrawingPermission permission) {
        return String.join("|",
            permission.getCategory() == null ? "" : permission.getCategory(),
            permission.getDrawing() == null ? "" : String.valueOf(permission.getDrawing().getDrawingId()),
            permission.getDept() == null ? "" : String.valueOf(permission.getDept().getDeptId()),
            permission.getEmp() == null ? "" : String.valueOf(permission.getEmp().getEmpId())
        );
    }

    private PdmDrawingRevision createRevision(
        PdmDrawing drawing,
        String revisionLabel,
        Integer revisionOrder,
        LocalDate revisionDate,
        LocalDate receivedDate,
        String changeNote,
        Emp current
    ) {
        return revisionRepository.save(PdmDrawingRevision.builder()
            .drawing(drawing)
            .revisionLabel(requireText(revisionLabel, "PDM_REVISION_LABEL_REQUIRED", "리비전을 입력해 주세요."))
            .revisionOrder(revisionOrder == null || revisionOrder <= 0 ? nextRevisionOrder(drawing) : revisionOrder)
            .revisionDate(revisionDate)
            .receivedDate(receivedDate)
            .changeNote(blankToNull(changeNote))
            .createdBy(current)
            .build());
    }

    private int nextRevisionOrder(PdmDrawing drawing) {
        return revisionRepository.findByDrawingOrderByRevisionOrderDescRevisionIdDesc(drawing).stream()
            .map(PdmDrawingRevision::getRevisionOrder)
            .filter(order -> order != null && order > 0)
            .findFirst()
            .map(order -> order + 1)
            .orElse(1);
    }

    private void attachFile(PdmDrawingRevision revision, MultipartFile file, String ipAddress, String userAgent) {
        if (file == null || file.isEmpty()) {
            throw BusinessException.badRequest("PDM_FILE_REQUIRED", "도면 파일을 첨부해 주세요.");
        }
        Long fileId = fileService.upload(PdmConstants.FILE_TARGET_REVISION, revision.getRevisionId(), file, ipAddress, userAgent).fileId();
        AttachFile attachFile = attachFileRepository.findById(fileId)
            .orElseThrow(() -> BusinessException.notFound("FILE_NOT_FOUND", "첨부파일을 찾을 수 없습니다."));
        revision.attachFile(attachFile);
    }

    private void markLatest(PdmDrawing drawing) {
        List<PdmDrawingRevision> revisions = revisionRepository.findByDrawingOrderByRevisionOrderDescRevisionIdDesc(drawing);
        PdmDrawingRevision latest = revisions.stream()
            .filter(revision -> !"Y".equals(revision.getVoidYn()))
            .findFirst()
            .orElse(null);
        for (PdmDrawingRevision revision : revisions) {
            revision.markLatest(latest != null && latest.getRevisionId().equals(revision.getRevisionId()));
        }
        if (latest != null) {
            drawing.markCurrentRevision(latest);
        } else {
            drawing.clearCurrentRevision();
        }
    }

    private PdmPermissionResponse permissions(Emp emp, PdmDrawing drawing) {
        boolean admin = isAdmin(emp);
        boolean register = admin || hasPermission(emp, drawing, "register");
        boolean revise = admin || hasPermission(emp, drawing, "revise");
        boolean view = admin || hasPermission(emp, drawing, "view");
        boolean requestDownload = admin || hasPermission(emp, drawing, "downloadRequest");
        boolean approveDownload = admin || hasPermission(emp, drawing, "downloadApprove");
        return new PdmPermissionResponse(admin, register, revise, view, requestDownload, approveDownload);
    }

    private void assertCanRegister(Emp emp, String category, PdmDrawing drawing) {
        if (!isAdmin(emp) && !hasPermission(emp, category, drawing, "register")) {
            throw BusinessException.forbidden("PDM_REGISTER_FORBIDDEN", "도면 등록 권한이 없습니다.");
        }
    }

    private void assertCanRevise(Emp emp, PdmDrawing drawing) {
        if (!isAdmin(emp) && !hasPermission(emp, drawing, "revise")) {
            throw BusinessException.forbidden("PDM_REVISE_FORBIDDEN", "도면 개정 권한이 없습니다.");
        }
    }

    private void assertCanView(Emp emp, PdmDrawing drawing) {
        if (!canView(emp, drawing)) {
            throw BusinessException.forbidden("PDM_VIEW_FORBIDDEN", "도면 조회 권한이 없습니다.");
        }
    }

    public boolean canView(Emp emp, PdmDrawing drawing) {
        return isAdmin(emp) || drawing.getCreatedByEmpId().equals(emp.getEmpId()) || hasPermission(emp, drawing, "view");
    }

    private void assertCanRequestDownload(Emp emp, PdmDrawing drawing) {
        assertCanView(emp, drawing);
        if (!isAdmin(emp) && !hasPermission(emp, drawing, "downloadRequest")) {
            throw BusinessException.forbidden("PDM_DOWNLOAD_REQUEST_FORBIDDEN", "도면 다운로드 요청 권한이 없습니다.");
        }
    }

    private void assertRevisionUsable(PdmDrawingRevision revision, String code, String message) {
        if ("Y".equals(revision.getVoidYn())) {
            throw BusinessException.badRequest(code, message);
        }
    }

    private void assertDrawingNotVoided(PdmDrawing drawing) {
        if (PdmDrawing.STATUS_VOIDED.equals(drawing.getStatus())) {
            throw BusinessException.badRequest("PDM_DRAWING_VOIDED", "폐기된 도면은 다운로드 요청하거나 다운로드할 수 없습니다.");
        }
    }

    private boolean hasPermission(Emp emp, PdmDrawing drawing, String action) {
        return hasPermission(emp, drawing.getCategory(), drawing, action);
    }

    private boolean hasPermission(Emp emp, String category, PdmDrawing drawing, String action) {
        return permissionRepository.findEffective(emp, emp.getDept()).stream()
            .filter(permission -> permission.getDrawing() == null || (drawing != null && permission.getDrawing().getDrawingId().equals(drawing.getDrawingId())))
            .filter(permission -> permission.getCategory() == null || permission.getCategory().equals(category))
            .anyMatch(permission -> switch (action) {
                case "register" -> "Y".equals(permission.getCanRegisterYn());
                case "revise" -> "Y".equals(permission.getCanReviseYn());
                case "view" -> "Y".equals(permission.getCanViewYn());
                case "downloadRequest" -> "Y".equals(permission.getCanDownloadRequestYn());
                case "downloadApprove" -> "Y".equals(permission.getCanDownloadApproveYn());
                default -> false;
            });
    }

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

    private PdmDrawing drawing(Long drawingId) {
        return drawingRepository.findById(drawingId)
            .orElseThrow(() -> BusinessException.notFound("PDM_DRAWING_NOT_FOUND", "도면을 찾을 수 없습니다."));
    }

    private PdmDrawingRevision revision(Long revisionId) {
        return revisionRepository.findById(revisionId)
            .orElseThrow(() -> BusinessException.notFound("PDM_REVISION_NOT_FOUND", "도면 리비전을 찾을 수 없습니다."));
    }

    private void assertAdmin(Emp emp) {
        if (!isAdmin(emp)) {
            throw BusinessException.forbidden("PDM_ADMIN_FORBIDDEN", "시스템 관리자만 도면 권한을 관리할 수 있습니다.");
        }
    }

    private void assertCanManagePermissions(Emp emp) {
        if (!isAdmin(emp) && !isDepartmentManager(emp)) {
            throw BusinessException.forbidden("PDM_PERMISSION_MANAGER_FORBIDDEN", "도면 권한을 관리할 수 없습니다.");
        }
    }

    private boolean isAdmin(Emp emp) {
        return emp != null && ("ADMIN".equals(emp.getRoleCode()) || "APPROVAL_ADMIN".equals(emp.getRoleCode()));
    }

    private boolean isDepartmentManager(Emp emp) {
        if (emp == null || emp.getDept() == null) {
            return false;
        }
        return "MANAGER".equals(emp.getRoleCode())
            || containsManagerTitle(emp.getJobTitle())
            || containsManagerTitle(emp.getPositionName());
    }

    private boolean containsManagerTitle(String value) {
        return value != null && (value.contains("팀장") || value.contains("부서장"));
    }

    private boolean canManagerViewPermission(Emp manager, PdmDrawingPermission permission) {
        Long managerDeptId = manager.getDept() == null ? null : manager.getDept().getDeptId();
        if (managerDeptId == null) {
            return false;
        }
        if (permission.getDept() != null && managerDeptId.equals(permission.getDept().getDeptId())) {
            return true;
        }
        return permission.getEmp() != null
            && permission.getEmp().getDept() != null
            && managerDeptId.equals(permission.getEmp().getDept().getDeptId());
    }

    private void assertManagerCanAssignPermission(
        Emp manager,
        String category,
        PdmDrawing drawing,
        Dept dept,
        Emp emp,
        PdmPermissionRequest request
    ) {
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
            .filter(permission -> permission.getEmp() == null)
            .filter(permission -> permission.getDrawing() == null)
            .filter(permission -> category == null ? permission.getCategory() == null : permission.getCategory() == null || category.equals(permission.getCategory()))
            .anyMatch(permission -> switch (action) {
                case "register" -> "Y".equals(permission.getCanRegisterYn());
                case "revise" -> "Y".equals(permission.getCanReviseYn());
                case "view" -> "Y".equals(permission.getCanViewYn());
                case "downloadRequest" -> "Y".equals(permission.getCanDownloadRequestYn());
                case "downloadApprove" -> "Y".equals(permission.getCanDownloadApproveYn());
                default -> false;
            });
    }

    private String downloadApprovalContent(PdmDrawing drawing, PdmDrawingRevision revision, String reason) {
        return String.join("\n",
            "도면 다운로드 요청",
            "도면번호: " + drawing.getDrawingNo(),
            "도면명: " + drawing.getTitle(),
            "구분: " + drawing.getCategory(),
            "리비전: " + revision.getRevisionLabel(),
            "최신본: " + ("Y".equals(revision.getLatestYn()) ? "Y" : "N"),
            "요청사유: " + reason
        );
    }

    private String downloadFormData(PdmDrawing drawing, PdmDrawingRevision revision, String reason) {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("drawingId", drawing.getDrawingId());
        fields.put("drawingNo", drawing.getDrawingNo());
        fields.put("drawingTitle", drawing.getTitle());
        fields.put("category", drawing.getCategory());
        fields.put("revisionId", revision.getRevisionId());
        fields.put("revisionLabel", revision.getRevisionLabel());
        fields.put("latest", "Y".equals(revision.getLatestYn()));
        fields.put("reason", reason);
        try {
            return objectMapper.writeValueAsString(Map.of("fields", fields, "content", downloadApprovalContent(drawing, revision, reason)));
        } catch (JsonProcessingException ex) {
            throw BusinessException.badRequest("PDM_DOWNLOAD_FORM_FAILED", "도면 다운로드 결재 데이터를 만들 수 없습니다.");
        }
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

    public record DownloadResource(AttachFile file, Resource resource) {
    }

}
