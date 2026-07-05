package com.kjh.groupware.domain.file;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalDocumentRepository;
import com.kjh.groupware.domain.approval.ApprovalEquipmentProposalService;
import com.kjh.groupware.domain.approval.ApprovalLine;
import com.kjh.groupware.domain.approval.ApprovalLineRepository;
import com.kjh.groupware.domain.approval.ApprovalPermissionService;
import com.kjh.groupware.domain.file.dto.AttachFileResponse;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.nio.file.Files;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
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
    private final ApprovalDocumentRepository approvalDocumentRepository;
    private final ApprovalLineRepository approvalLineRepository;
    private final ApprovalPermissionService approvalPermissionService;
    private final ApprovalEquipmentProposalService equipmentProposalService;

    @Value("${app.file.storage-path:uploads}")
    private String storagePath;

    @Value("${app.file.allowed-extensions:pdf,png,jpg,jpeg,gif,webp,txt,csv,xlsx,xls,doc,docx,ppt,pptx,hwp,hwpx,zip}")
    private String allowedExtensions;

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
        assertTargetWritable(targetType, targetId);
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        String originalFileName = StringUtils.cleanPath(multipartFile.getOriginalFilename() == null
            ? "file"
            : multipartFile.getOriginalFilename());
        String fileExt = extractExtension(originalFileName);
        validateAllowedExtension(fileExt);
        String storedFileName = UUID.randomUUID() + (fileExt == null ? "" : "." + fileExt);
        Path uploadDir = Path.of(storagePath).toAbsolutePath().normalize();
        Path destination = uploadDir.resolve(storedFileName).normalize();

        try {
            Files.createDirectories(uploadDir);
            multipartFile.transferTo(destination);
            validateStoredContent(fileExt, destination);
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

    @Transactional
    public AttachFile saveGeneratedFile(
        String targetType,
        Long targetId,
        String originalFileName,
        byte[] bytes,
        String mimeType,
        Emp createdBy
    ) {
        if (bytes == null || bytes.length == 0) {
            throw BusinessException.badRequest("EMPTY_FILE", "Generated file is empty");
        }
        String cleanName = StringUtils.cleanPath(originalFileName == null ? "generated-file" : originalFileName);
        String fileExt = extractExtension(cleanName);
        String storedFileName = UUID.randomUUID() + (fileExt == null ? "" : "." + fileExt);
        Path uploadDir = Path.of(storagePath).toAbsolutePath().normalize();
        Path destination = uploadDir.resolve(storedFileName).normalize();
        try {
            Files.createDirectories(uploadDir);
            Files.write(destination, bytes);
            validateStoredContent(fileExt, destination);
        } catch (IOException ex) {
            throw BusinessException.badRequest("FILE_SAVE_FAILED", "Failed to save generated file");
        }

        return attachFileRepository.save(AttachFile.builder()
            .targetType(targetType)
            .targetId(targetId)
            .originalFileName(cleanName)
            .storedFileName(storedFileName)
            .storagePath(uploadDir.toString())
            .fileSize((long) bytes.length)
            .fileExt(fileExt)
            .fileHash(sha256(destination))
            .mimeType(mimeType)
            .createdBy(createdBy)
            .build());
    }

    @Transactional(readOnly = true)
    public List<AttachFileResponse> findByTarget(String targetType, Long targetId) {
        assertTargetReadable(targetType, targetId);
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

    public boolean hasPdfHeader(AttachFile file) {
        return hasPdfHeader(Path.of(file.getStoragePath(), file.getStoredFileName()));
    }

    @Transactional
    public void delete(Long fileId, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        AttachFile file = getDownloadableFile(fileId);
        assertTargetWritable(file.getTargetType(), file.getTargetId());
        file.delete(currentEmp);
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.DELETE, "attach_file", file.getFileId(), ipAddress, userAgent);
    }

    @Transactional
    public void recordDownload(Long fileId, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        AttachFile file = getDownloadableFile(fileId);
        assertTargetReadable(file.getTargetType(), file.getTargetId());
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.DOWNLOAD, "attach_file", fileId, null, null, ipAddress, userAgent, "첨부파일 다운로드 시도", true);
    }

    public MediaType mediaType(AttachFile file) {
        try {
            return file.getMimeType() == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(file.getMimeType());
        } catch (RuntimeException ex) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    private String extractExtension(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == fileName.length() - 1) {
            return null;
        }
        return fileName.substring(dotIndex + 1).toLowerCase();
    }

    private void validateAllowedExtension(String fileExt) {
        if (fileExt == null || fileExt.isBlank()) {
            throw BusinessException.badRequest("FILE_EXTENSION_REQUIRED", "확장자가 있는 파일만 업로드할 수 있습니다.");
        }
        Set<String> allowed = allowedExtensionSet();
        if (!allowed.contains(fileExt.toLowerCase())) {
            throw BusinessException.badRequest("FILE_EXTENSION_NOT_ALLOWED", "허용되지 않은 파일 형식입니다: " + fileExt);
        }
    }

    private void validateStoredContent(String fileExt, Path destination) throws IOException {
        if ("pdf".equalsIgnoreCase(fileExt) && !hasPdfHeader(destination)) {
            Files.deleteIfExists(destination);
            throw BusinessException.badRequest("INVALID_PDF_FILE", "PDF 확장자이지만 실제 PDF 파일이 아닙니다.");
        }
    }

    private boolean hasPdfHeader(Path path) {
        try (InputStream inputStream = Files.newInputStream(path)) {
            byte[] header = inputStream.readNBytes(5);
            return header.length == 5
                && header[0] == '%'
                && header[1] == 'P'
                && header[2] == 'D'
                && header[3] == 'F'
                && header[4] == '-';
        } catch (IOException ex) {
            return false;
        }
    }

    private Set<String> allowedExtensionSet() {
        return java.util.Arrays.stream(allowedExtensions.split(","))
            .map(String::trim)
            .map(String::toLowerCase)
            .filter(value -> !value.isBlank())
            .collect(Collectors.toSet());
    }

    public String sha256(Path path) {
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

    private void assertTargetWritable(String targetType, Long targetId) {
        if (targetType == null || targetId == null) {
            return;
        }
        if (isApprovalPdfTarget(targetType)) {
            throw BusinessException.forbidden("APPROVAL_PDF_WRITE_FORBIDDEN", "PDF 파일은 직접 수정할 수 없습니다.");
        }
        if (equipmentProposalService.isEquipmentAttachmentTarget(targetType)) {
            Emp currentEmp = currentEmpProvider.getCurrentEmp();
            if (!equipmentProposalService.canWriteAttachment(targetType, targetId, currentEmp)) {
                throw BusinessException.forbidden("EQUIPMENT_FILE_WRITE_FORBIDDEN", "This equipment proposal attachment section is not editable");
            }
            return;
        }
        if (!isApprovalDocumentTarget(targetType)) {
            return;
        }
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = approvalDocumentRepository.findById(targetId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found"));
        if (!document.getRequester().getEmpId().equals(currentEmp.getEmpId()) || !document.isEditableDraft()) {
            throw BusinessException.forbidden("APPROVAL_FILE_WRITE_FORBIDDEN", "첨부파일을 수정할 권한이 없습니다.");
        }
    }

    private void assertTargetReadable(String targetType, Long targetId) {
        if (targetType == null || targetId == null || (!isApprovalDocumentTarget(targetType) && !isApprovalPdfTarget(targetType) && !equipmentProposalService.isEquipmentAttachmentTarget(targetType))) {
            return;
        }
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = approvalDocumentRepository.findById(targetId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found"));
        List<ApprovalLine> lines = approvalLineRepository.findByDocumentOrderByLineOrderAsc(document);
        if (isApprovalPdfTarget(targetType)) {
            approvalPermissionService.assertCanPrintPdf(currentEmp, document, lines);
        } else {
            approvalPermissionService.assertCanDownloadAttachment(currentEmp, document, lines);
        }
    }

    private boolean isApprovalDocumentTarget(String targetType) {
        return "APPROVAL".equals(targetType) || "APPROVAL_DOCUMENT".equals(targetType);
    }

    private boolean isApprovalPdfTarget(String targetType) {
        return "APPROVAL_PDF".equals(targetType);
    }
}
