package com.kjh.groupware.domain.pdm.dto;

public record PdmDuplicateCheckResponse(
    boolean duplicate,
    Long drawingId,
    String drawingNo,
    String title,
    String message
) {
}
