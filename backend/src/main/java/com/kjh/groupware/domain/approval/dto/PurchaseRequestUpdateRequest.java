package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.Size;
import java.util.List;

public record PurchaseRequestUpdateRequest(
    @Size(max = 20) String deliveryDate,
    List<Long> agreementEmpIds,
    List<Long> approverEmpIds
) {
}
