package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalDefaultLine;
import java.util.List;

public record ApprovalDefaultLineResponse(
    Long defaultLineId,
    String lineName,
    String defaultType,
    String source,
    String templateCode,
    List<ApprovalDefaultLineStepResponse> steps
) {

    public static ApprovalDefaultLineResponse empty() {
        return new ApprovalDefaultLineResponse(null, null, null, "EMPTY", null, List.of());
    }

    public static ApprovalDefaultLineResponse from(
        ApprovalDefaultLine defaultLine,
        String source,
        List<ApprovalDefaultLineStepResponse> steps
    ) {
        return new ApprovalDefaultLineResponse(
            defaultLine.getDefaultLineId(),
            defaultLine.getLineName(),
            defaultLine.getDefaultType(),
            source,
            defaultLine.getTemplateCode(),
            steps
        );
    }
}
