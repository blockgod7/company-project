package com.kjh.groupware.domain.pdm;

import com.kjh.groupware.domain.pdm.dto.PdmDownloadRequestCreateRequest;
import com.kjh.groupware.domain.pdm.dto.PdmDownloadRequestResponse;
import com.kjh.groupware.domain.pdm.dto.PdmDrawingDetailResponse;
import com.kjh.groupware.domain.pdm.dto.PdmDrawingResponse;
import com.kjh.groupware.domain.pdm.dto.PdmDrawingStatusRequest;
import com.kjh.groupware.domain.pdm.dto.PdmDuplicateCheckResponse;
import com.kjh.groupware.domain.pdm.dto.PdmFolderPathRenameRequest;
import com.kjh.groupware.domain.pdm.dto.PdmFolderPathRequest;
import com.kjh.groupware.domain.pdm.dto.PdmFolderMoveRequest;
import com.kjh.groupware.domain.pdm.dto.PdmFolderRequest;
import com.kjh.groupware.domain.pdm.dto.PdmFolderResponse;
import com.kjh.groupware.domain.pdm.dto.PdmPermissionAdminResponse;
import com.kjh.groupware.domain.pdm.dto.PdmPermissionRequest;
import com.kjh.groupware.domain.pdm.dto.PdmPermissionResponse;
import com.kjh.groupware.global.response.ApiResponse;
import com.kjh.groupware.global.response.PageResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/pdm")
@RequiredArgsConstructor
public class PdmController {

    private final PdmService pdmService;
    private final com.kjh.groupware.domain.file.FileService fileService;

    @GetMapping("/drawings")
    public ApiResponse<PageResponse<PdmDrawingResponse>> drawings(
        @RequestParam(required = false) String category,
        @RequestParam(required = false) String keyword,
        @RequestParam(required = false, defaultValue = "0") int page,
        @RequestParam(required = false, defaultValue = "30") int size
    ) {
        return ApiResponse.ok(pdmService.drawings(category, keyword, page, size));
    }

    @GetMapping("/folders")
    public ApiResponse<List<PdmFolderResponse>> folders() {
        return ApiResponse.ok(pdmService.folders());
    }

    @GetMapping("/permissions/effective")
    public ApiResponse<PdmPermissionResponse> effectivePermission(
        @RequestParam(required = false) String category,
        @RequestParam(required = false) Long drawingId
    ) {
        return ApiResponse.ok(pdmService.effectivePermission(category, drawingId));
    }

    @PostMapping("/folders")
    public ApiResponse<PdmFolderResponse> createFolder(@Valid @RequestBody PdmFolderRequest request) {
        return ApiResponse.ok(pdmService.createFolder(request));
    }

    @PutMapping("/folders/{folderId}")
    public ApiResponse<PdmFolderResponse> renameFolder(@PathVariable Long folderId, @Valid @RequestBody PdmFolderRequest request) {
        return ApiResponse.ok(pdmService.renameFolder(folderId, request));
    }

    @PostMapping("/folders/actions/rename")
    public ApiResponse<List<PdmFolderResponse>> renameFolderPath(@Valid @RequestBody PdmFolderPathRenameRequest request) {
        return ApiResponse.ok(pdmService.renameFolderPath(request));
    }

    @PostMapping("/folders/actions/delete")
    public ApiResponse<List<PdmFolderResponse>> deleteFolderPath(@Valid @RequestBody PdmFolderPathRequest request) {
        return ApiResponse.ok(pdmService.deleteFolderPath(request));
    }

    @PostMapping("/folders/{folderId}/actions/move")
    public ApiResponse<List<PdmFolderResponse>> moveFolder(@PathVariable Long folderId, @Valid @RequestBody PdmFolderMoveRequest request) {
        return ApiResponse.ok(pdmService.moveFolder(folderId, request));
    }

    @GetMapping("/drawings/{drawingId}")
    public ApiResponse<PdmDrawingDetailResponse> detail(@PathVariable Long drawingId) {
        return ApiResponse.ok(pdmService.detail(drawingId));
    }

    @GetMapping("/drawings/duplicate")
    public ApiResponse<PdmDuplicateCheckResponse> duplicate(@RequestParam String drawingNo) {
        return ApiResponse.ok(pdmService.duplicate(drawingNo));
    }

    @PostMapping("/drawings")
    public ApiResponse<PdmDrawingDetailResponse> uploadNewDrawing(
        @RequestParam String category,
        @RequestParam String drawingNo,
        @RequestParam String title,
        @RequestParam(required = false) String companyName,
        @RequestParam(required = false) String projectName,
        @RequestParam(required = false) String businessUnit,
        @RequestParam(required = false) String processName,
        @RequestParam(required = false) String equipmentName,
        @RequestParam(required = false) String groupName,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String description,
        @RequestParam String revisionLabel,
        @RequestParam(required = false) Integer revisionOrder,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate revisionDate,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate receivedDate,
        @RequestParam(required = false) String changeNote,
        @RequestParam MultipartFile file,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(pdmService.uploadNewDrawing(
            category,
            drawingNo,
            title,
            companyName,
            projectName,
            businessUnit,
            processName,
            equipmentName,
            groupName,
            status,
            description,
            revisionLabel,
            revisionOrder,
            revisionDate,
            receivedDate,
            changeNote,
            file,
            httpRequest.getRemoteAddr(),
            httpRequest.getHeader("User-Agent")
        ));
    }

    @PostMapping("/drawings/{drawingId}/revisions")
    public ApiResponse<PdmDrawingDetailResponse> addRevision(
        @PathVariable Long drawingId,
        @RequestParam String revisionLabel,
        @RequestParam(required = false) Integer revisionOrder,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate revisionDate,
        @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate receivedDate,
        @RequestParam(required = false) String changeNote,
        @RequestParam MultipartFile file,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(pdmService.addRevision(
            drawingId,
            revisionLabel,
            revisionOrder,
            revisionDate,
            receivedDate,
            changeNote,
            file,
            httpRequest.getRemoteAddr(),
            httpRequest.getHeader("User-Agent")
        ));
    }

    @PostMapping("/drawings/{drawingId}/actions/void")
    public ApiResponse<PdmDrawingDetailResponse> voidDrawing(
        @PathVariable Long drawingId,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(pdmService.voidDrawing(drawingId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/drawings/{drawingId}/actions/status")
    public ApiResponse<PdmDrawingDetailResponse> updateDrawingStatus(
        @PathVariable Long drawingId,
        @Valid @RequestBody PdmDrawingStatusRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(pdmService.updateDrawingStatus(drawingId, request.status(), httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/revisions/{revisionId}/actions/delete")
    public ApiResponse<PdmDrawingDetailResponse> deleteRevision(
        @PathVariable Long revisionId,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(pdmService.deleteRevision(revisionId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @GetMapping("/revisions/{revisionId}/preview")
    public ResponseEntity<Resource> preview(@PathVariable Long revisionId) {
        PdmService.DownloadResource preview = pdmService.preview(revisionId);
        String encodedName = URLEncoder.encode(preview.file().getOriginalFileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
            .contentType(fileService.mediaType(preview.file()))
            .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0")
            .header(HttpHeaders.PRAGMA, "no-cache")
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(encodedName).build().toString())
            .body(preview.resource());
    }

    @PostMapping("/revisions/{revisionId}/download-requests")
    public ApiResponse<PdmDownloadRequestResponse> requestDownload(
        @PathVariable Long revisionId,
        @Valid @RequestBody PdmDownloadRequestCreateRequest request,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(pdmService.requestDownload(revisionId, request, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @GetMapping("/download-requests/me")
    public ApiResponse<List<PdmDownloadRequestResponse>> myDownloadRequests() {
        return ApiResponse.ok(pdmService.myDownloadRequests());
    }

    @GetMapping("/download-requests/{requestId}/download")
    public ResponseEntity<Resource> download(@PathVariable Long requestId, HttpServletRequest httpRequest) {
        PdmService.DownloadResource download = pdmService.download(requestId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        String encodedName = URLEncoder.encode(download.file().getOriginalFileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
            .contentType(fileService.mediaType(download.file()))
            .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache, must-revalidate, max-age=0")
            .header(HttpHeaders.PRAGMA, "no-cache")
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(encodedName).build().toString())
            .body(download.resource());
    }

    @GetMapping("/permissions")
    public ApiResponse<List<PdmPermissionAdminResponse>> permissions() {
        return ApiResponse.ok(pdmService.permissions());
    }

    @PostMapping("/permissions")
    public ApiResponse<PdmPermissionAdminResponse> savePermission(@Valid @RequestBody PdmPermissionRequest request) {
        return ApiResponse.ok(pdmService.savePermission(request));
    }
}
