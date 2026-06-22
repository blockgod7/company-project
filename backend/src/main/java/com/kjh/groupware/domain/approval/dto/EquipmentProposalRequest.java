package com.kjh.groupware.domain.approval.dto;

import java.util.List;

public record EquipmentProposalRequest(
    String requestDeptName,
    String equipmentName,
    String requiredCompletionDate,
    String equipmentCapacity,
    String requestType,
    String currentState,
    String requirements,
    String instructions,
    String userEconomicReview,
    String peOpinion,
    String designOpinion,
    String peEconomicReview,
    String purchaseOpinion,
    String vendorName,
    String deliveryDueDate,
    String purchaseItemName,
    String purchaseUsage,
    String quantity,
    String price,
    String purchaseNote,
    Boolean attachmentContract,
    Boolean attachmentQuote,
    Boolean attachmentDrawing,
    Boolean attachmentSpec,
    String attachmentEtc,
    Long peAssigneeEmpId,
    Long purchaseAssigneeEmpId,
    List<Long> agreementEmpIds,
    List<Long> approverEmpIds
) {
}
