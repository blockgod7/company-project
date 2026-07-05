package com.kjh.groupware.domain.pdm.dto;

import com.kjh.groupware.domain.pdm.PdmDrawing;
import com.kjh.groupware.domain.pdm.PdmDrawingRevision;
import java.time.LocalDateTime;

public record PdmDrawingResponse(
    Long drawingId,
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
    Long currentRevisionId,
    String currentRevisionLabel,
    Integer currentRevisionOrder,
    String currentOriginalFileName,
    LocalDateTime createdAt
) {
    public static PdmDrawingResponse from(PdmDrawing drawing) {
        PdmDrawingRevision revision = drawing.getCurrentRevision();
        return new PdmDrawingResponse(
            drawing.getDrawingId(),
            drawing.getCategory(),
            drawing.getDrawingNo(),
            drawing.getTitle(),
            drawing.getCompanyName(),
            drawing.getProjectName(),
            drawing.getBusinessUnit(),
            drawing.getProcessName(),
            drawing.getEquipmentName(),
            drawing.getGroupName(),
            drawing.getStatus(),
            drawing.getDescription(),
            revision == null ? null : revision.getRevisionId(),
            revision == null ? null : revision.getRevisionLabel(),
            revision == null ? null : revision.getRevisionOrder(),
            revision == null || revision.getFile() == null ? null : revision.getFile().getOriginalFileName(),
            drawing.getCreatedAt()
        );
    }
}
