package com.kjh.groupware.domain.file;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.file.dto.AttachFileResponse;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class FileService {

    private static final long MAX_FILE_SIZE = 100L * 1024L * 1024L;

    private final AttachFileRepository attachFileRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;

    @Value("${app.file.storage-path:uploads}")
    private String storagePath;

    @Transactional
    public AttachFileResponse upload(
        String targetType,
        Long targetId,
        MultipartFile multipartFile,
        String ipAddress,
        String userAgent
    ) {
        if (multipartFile.isEmpty()) {
            throw BusinessException.badRequest("EMPTY_FILE", "Uploaded file is empty");
        }
        if (multipartFile.getSize() > MAX_FILE_SIZE) {
            throw BusinessException.badRequest("FILE_TOO_LARGE", "File size must be 100MB or less");
        }
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        String originalFileName = StringUtils.cleanPath(multipartFile.getOriginalFilename() == null
            ? "file"
            : multipartFile.getOriginalFilename());
        String fileExt = extractExtension(originalFileName);
        String storedFileName = UUID.randomUUID() + (fileExt == null ? "" : "." + fileExt);
        Path uploadDir = Path.of(storagePath).toAbsolutePath().normalize();
        Path destination = uploadDir.resolve(storedFileName).normalize();

        try {
            Files.createDirectories(uploadDir);
            multipartFile.transferTo(destination);
        } catch (IOException ex) {
            throw BusinessException.badRequest("FILE_SAVE_FAILED", "Failed to save uploaded file");
        }

        AttachFile saved = attachFileRepository.save(AttachFile.builder()
            .targetType(targetType)
            .targetId(targetId)
            .originalFileName(originalFileName)
            .storedFileName(storedFileName)
            .storagePath(uploadDir.toString())
            .fileSize(multipartFile.getSize())
            .fileExt(fileExt)
            .fileHash(sha256(destination))
            .mimeType(multipartFile.getContentType())
            .createdBy(currentEmp)
            .build());
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.CREATE, "attach_file", saved.getFileId(), ipAddress, userAgent);
        return AttachFileResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<AttachFileResponse> findByTarget(String targetType, Long targetId) {
        return attachFileRepository.findByTargetTypeAndTargetIdAndDeletedYnOrderByFileIdAsc(targetType, targetId, "N").stream()
            .map(AttachFileResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public AttachFile getDownloadableFile(Long fileId) {
        AttachFile file = attachFileRepository.findById(fileId)
            .orElseThrow(() -> BusinessException.notFound("FILE_NOT_FOUND", "File was not found"));
        if ("Y".equals(file.getDeletedYn())) {
            throw BusinessException.notFound("FILE_NOT_FOUND", "File was not found");
        }
        return file;
    }

    public Resource loadResource(AttachFile file) {
        try {
            Resource resource = new UrlResource(Path.of(file.getStoragePath(), file.getStoredFileName()).toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw BusinessException.notFound("FILE_NOT_FOUND", "Stored file was not found");
            }
            return resource;
        } catch (IOException ex) {
            throw BusinessException.notFound("FILE_NOT_FOUND", "Stored file was not found");
        }
    }

    @Transactional
    public void delete(Long fileId, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        AttachFile file = getDownloadableFile(fileId);
        file.delete(currentEmp);
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.DELETE, "attach_file", file.getFileId(), ipAddress, userAgent);
    }

    @Transactional
    public void recordDownload(Long fileId, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.DOWNLOAD, "attach_file", fileId, ipAddress, userAgent);
    }

    public MediaType mediaType(AttachFile file) {
        return file.getMimeType() == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(file.getMimeType());
    }

    private String extractExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == fileName.length() - 1) {
            return null;
        }
        return fileName.substring(dotIndex + 1).toLowerCase();
    }

    private String sha256(Path path) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream inputStream = Files.newInputStream(path);
                 DigestInputStream digestInputStream = new DigestInputStream(inputStream, digest)) {
                digestInputStream.transferTo(OutputStreamDiscard.INSTANCE);
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (IOException | NoSuchAlgorithmException ex) {
            return null;
        }
    }
}
