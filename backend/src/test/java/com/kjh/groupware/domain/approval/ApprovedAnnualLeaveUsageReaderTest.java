package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.emp.Emp;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ApprovedAnnualLeaveUsageReaderTest {

    private final ApprovalDocumentRepository documentRepository = mock(ApprovalDocumentRepository.class);
    private final ApprovalLeaveExclusionRepository exclusionRepository = mock(ApprovalLeaveExclusionRepository.class);
    private final ApprovalLeaveLifecycleCancellationRepository lifecycleCancellationRepository =
        mock(ApprovalLeaveLifecycleCancellationRepository.class);
    private final LeavePolicyService leavePolicyService = mock(LeavePolicyService.class);
    private final Emp requester = mock(Emp.class);
    private final ApprovedAnnualLeaveUsageReader reader = new ApprovedAnnualLeaveUsageReader(
        documentRepository, exclusionRepository, lifecycleCancellationRepository,
        leavePolicyService, new ObjectMapper()
    );

    @BeforeEach
    void setUp() {
        when(exclusionRepository.findByDocumentRequesterOrderByLeaveDateAsc(requester)).thenReturn(List.of());
        when(lifecycleCancellationRepository.findByEmpAndActiveYn(requester, "Y")).thenReturn(List.of());
    }

    @Test
    void countsOnlyBalanceYearSelectionsRemainingAfterApprovedCancellation() {
        ApprovalDocument leave = document(101L, "LEAVE", formData(
            "[{\"date\":\"2025-08-04\",\"type\":\"연차\"},"
                + "{\"date\":\"2025-08-05\",\"type\":\"오전반차\"},"
                + "{\"date\":\"2026-01-02\",\"type\":\"연차\"}]"
        ));
        ApprovalDocument cancellation = document(201L, "LEAVE_CANCEL", formData(
            "[{\"date\":\"2025-08-04\",\"type\":\"연차\",\"sourceApprovalId\":101}]"
        ));
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", "LEAVE", ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of(leave));
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", "LEAVE_CANCEL", ApprovalDocument.STATUS_APPROVED
        )).thenReturn(List.of(cancellation));

        BigDecimal used = reader.approvedAnnualDays(requester, 2025);

        assertThat(used).isEqualByComparingTo("0.5");
    }

    private String formData(String selectionsJson) {
        try {
            String escaped = new ObjectMapper().writeValueAsString(selectionsJson);
            return "{\"fields\":{\"leaveSelectionsJson\":" + escaped + "}}";
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private ApprovalDocument document(Long approvalId, String templateCode, String formDataJson) {
        ApprovalDocument document = ApprovalDocument.builder()
            .title("Leave")
            .content("content")
            .documentNo(templateCode + "-" + approvalId)
            .templateCode(templateCode)
            .formDataJson(formDataJson)
            .requester(requester)
            .build();
        ReflectionTestUtils.setField(document, "approvalId", approvalId);
        ReflectionTestUtils.setField(document, "status", ApprovalDocument.STATUS_APPROVED);
        return document;
    }
}
