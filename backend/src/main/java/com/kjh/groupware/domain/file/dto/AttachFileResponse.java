package com.kjh.groupware.domain.file.dto;

import com.kjh.groupware.domain.file.AttachFile;
import java.time.LocalDateTime;

public record AttachFileResponse(
    Long fileId,
    String targetType,
    Long targetId,
    String originalFileName,
    Long fileSize,
    String fileExt,
    String mimeType,
    LocalDateTime createdAt
) {

    public static AttachFileResponse from(AttachFile file) {
        return new AttachFileResponse(
            file.getFileId(),
            file.getTargetType(),
            file.getTargetId(),
            file.getOriginalFileName(),
            file.getFileSize(),
            file.getFileExt(),
            file.getMimeType(),
            file.getCreatedAt()
        );
    }
}
