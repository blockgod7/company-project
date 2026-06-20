package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ApprovalTemplate;

public record ApprovalTemplateResponse(
    String templateCode,
    String templateName,
    Integer version,
    String description,
    String fieldsJson,
    String printLayoutJson,
    String activeYn,
    Integer sortOrder
) {

    public static ApprovalTemplateResponse from(ApprovalTemplate template) {
        return new ApprovalTemplateResponse(
            template.getTemplateCode(),
            template.getTemplateName(),
            template.getVersion(),
            template.getDescription(),
            template.getFieldsJson(),
            template.getPrintLayoutJson(),
            template.getActiveYn(),
            template.getSortOrder()
        );
    }
}
