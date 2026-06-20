package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ApprovalDefaultLineRequest(
    @Size(max = 100) String lineName,
    @Size(max = 50) String templateCode,
    @Valid @NotEmpty List<ApprovalDefaultLineStepRequest> steps
) {
}
