package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.Size;
import java.util.List;

public record ApprovalRequest(
    @Size(max = 200) String title,
    String content,
    @jakarta.validation.constraints.NotBlank @Size(max = 50) String templateCode,
    String formDataJson,
    @Size(max = 30) String priority,
    List<Long> agreementEmpIds,
    List<Long> approverEmpIds,
    List<Long> receiverEmpIds,
    List<Long> referenceEmpIds,
    List<Long> readerEmpIds,
    Boolean draft
) {
}
