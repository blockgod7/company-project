package com.kjh.groupware.domain.pdm.dto;

import com.kjh.groupware.domain.pdm.PdmDrawingRevision;
import java.time.LocalDate;
import java.time.LocalDateTime;

public record PdmRevisionResponse(
    Long revisionId,
    Long drawingId,
    String revisionLabel,
    Integer revisionOrder,
    LocalDate revisionDate,
    LocalDate receivedDate,
    Long fileId,
    String originalFileName,
    String latestYn,
    String voidYn,
    String changeNote,
    LocalDateTime createdAt
) {
    public static PdmRevisionResponse from(PdmDrawingRevision revision) {
        return new PdmRevisionResponse(
            revision.getRevisionId(),
            revision.getDrawing().getDrawingId(),
            revision.getRevisionLabel(),
            revision.getRevisionOrder(),
            revision.getRevisionDate(),
            revision.getReceivedDate(),
            revision.getFile() == null ? null : revision.getFile().getFileId(),
            revision.getFile() == null ? null : revision.getFile().getOriginalFileName(),
            revision.getLatestYn(),
            revision.getVoidYn(),
            revision.getChangeNote(),
            revision.getCreatedAt()
        );
    }
}
