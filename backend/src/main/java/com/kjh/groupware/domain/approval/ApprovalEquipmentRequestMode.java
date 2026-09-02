package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.emp.Emp;

/** Server-owned routing snapshot; missing markers preserve the legacy workflow. */
final class ApprovalEquipmentRequestMode {
    static final String FIELD = "equipmentRequestMode";
    static final String PE_SELF = "PE_SELF";
    static final String STANDARD = "STANDARD";
    private static final ObjectMapper JSON = new ObjectMapper();

    private ApprovalEquipmentRequestMode() {}

    static boolean isProductionEngineering(Emp emp) {
        return emp != null && emp.getDept() != null && "PROD_TECH".equals(emp.getDept().getDeptCode());
    }

    static boolean isSelfRequest(ApprovalDocument document) {
        if (document == null || !ApprovalEquipmentProposal.isProposalTemplate(document.getTemplateCode()) || document.getFormDataJson() == null) return false;
        try {
            JsonNode root = JSON.readTree(document.getFormDataJson());
            if (root == null) return false;
            JsonNode fields = root.path("fields").isObject() ? root.path("fields") : root;
            return PE_SELF.equals(fields.path(FIELD).asText());
        } catch (java.io.IOException ex) {
            return false;
        }
    }
}
