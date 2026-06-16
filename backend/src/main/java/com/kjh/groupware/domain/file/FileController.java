package com.kjh.groupware.domain.file;

import com.kjh.groupware.domain.file.dto.AttachFileResponse;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    @PostMapping
    public ApiResponse<AttachFileResponse> upload(
        @RequestParam String targetType,
        @RequestParam Long targetId,
        @RequestParam MultipartFile file,
        HttpServletRequest httpRequest
    ) {
        return ApiResponse.ok(fileService.upload(targetType, targetId, file, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
    }

    @PostMapping("/batch")
    public ApiResponse<List<AttachFileResponse>> uploadBatch(
        @RequestParam String targetType,
        @RequestParam Long targetId,
        @RequestParam("files") List<MultipartFile> files,
        HttpServletRequest httpRequest
    ) {
        List<AttachFileResponse> responses = new ArrayList<>();
        for (MultipartFile file : files) {
            responses.add(fileService.upload(targetType, targetId, file, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent")));
        }
        return ApiResponse.ok(responses);
    }

    @GetMapping
    public ApiResponse<List<AttachFileResponse>> findByTarget(
        @RequestParam String targetType,
        @RequestParam Long targetId
    ) {
        return ApiResponse.ok(fileService.findByTarget(targetType, targetId));
    }

    @GetMapping("/{fileId}/download")
    public ResponseEntity<Resource> download(@PathVariable Long fileId, HttpServletRequest httpRequest) {
        AttachFile file = fileService.getDownloadableFile(fileId);
        Resource resource = fileService.loadResource(file);
        fileService.recordDownload(fileId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        String encodedName = URLEncoder.encode(file.getOriginalFileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
            .contentType(fileService.mediaType(file))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(encodedName).build().toString())
            .body(resource);
    }

    @DeleteMapping("/{fileId}")
    public ApiResponse<Void> delete(@PathVariable Long fileId, HttpServletRequest httpRequest) {
        fileService.delete(fileId, httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        return ApiResponse.ok(null, "Deleted");
    }
}
