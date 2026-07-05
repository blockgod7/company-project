package com.kjh.groupware.domain.pdm.dto;

import java.util.List;

public record PdmDrawingDetailResponse(
    PdmDrawingResponse drawing,
    List<PdmRevisionResponse> revisions,
    PdmPermissionResponse permissions
) {
}
