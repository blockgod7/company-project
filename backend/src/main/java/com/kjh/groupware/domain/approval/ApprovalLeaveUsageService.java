package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.LeaveUsageResponse;
import com.kjh.groupware.domain.approval.dto.LeaveUsageSelectionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalLeaveUsageService {

    static final String LEAVE_TEMPLATE_CODE = "LEAVE";
    static final String LEAVE_CANCEL_TEMPLATE_CODE = "LEAVE_CANCEL";
    private final ApprovalDocumentRepository documentRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final ObjectMapper objectMapper;
    private final AnnualLeaveService annualLeaveService;

    @Transactional(readOnly = true)
    public LeaveUsageResponse myUsage() {
        return usageFor(currentEmpProvider.getCurrentEmp(), null);
    }

    @Transactional(readOnly = true)
    public void assertNoCompletedLeaveOverlap(ApprovalDocument document) {
        if (!LEAVE_TEMPLATE_CODE.equals(document.getTemplateCode())) {
            return;
        }
        assertNoCompletedLeaveOverlap(document.getRequester(), document.getApprovalId(), document.getFormDataJson());
    }

    @Transactional(readOnly = true)
    public void assertLeaveCancelTargetsApproved(ApprovalDocument document) {
        if (!LEAVE_CANCEL_TEMPLATE_CODE.equals(document.getTemplateCode())) {
            return;
        }
        assertLeaveCancelTargetsApproved(document.getRequester(), document.getApprovalId(), document.getFormDataJson());
    }

    @Transactional(readOnly = true)
    public void assertLeaveCancelTargetsApproved(Emp requester, Long excludeApprovalId, String formDataJson) {
        LeaveUsageResponse usage = usageFor(requester, excludeApprovalId);
        Map<String, LeaveUsageSelectionResponse> approvedDates = new LinkedHashMap<>();
        usage.selections().forEach(selection -> approvedDates.put(selection.date(), selection));
        List<LeaveUsageSelectionResponse> cancelSelections = selectionsFrom(formDataJson, null, null);
        if (cancelSelections.isEmpty()) {
            throw BusinessException.badRequest("LEAVE_CANCEL_DATE_REQUIRED", "Leave cancel date is required");
        }
        for (LeaveUsageSelectionResponse selection : cancelSelections) {
            if (!approvedDates.containsKey(selection.date())) {
                throw BusinessException.badRequest(
                    "LEAVE_CANCEL_DATE_NOT_APPROVED",
                    selection.date() + " is not an approved leave date"
                );
            }
        }
    }

    @Transactional(readOnly = true)
    public void assertNoCompletedLeaveOverlap(Emp requester, Long excludeApprovalId, String formDataJson) {
        LeaveUsageResponse usage = usageFor(requester, excludeApprovalId);
        Map<String, LeaveUsageSelectionResponse> completedDates = new LinkedHashMap<>();
        usage.selections().forEach(selection -> completedDates.put(selection.date(), selection));
        for (LeaveUsageSelectionResponse selection : selectionsFrom(formDataJson, null, null)) {
            LeaveUsageSelectionResponse locked = completedDates.get(selection.date());
            if (locked != null) {
                throw BusinessException.badRequest(
                    "LEAVE_DATE_ALREADY_APPROVED",
                    selection.date() + " is already approved as " + locked.type()
                );
            }
        }
    }

    private LeaveUsageResponse usageFor(Emp requester, Long excludeApprovalId) {
        List<ApprovalDocument> leaveDocuments = documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester,
            "N",
            LEAVE_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED
        );
        List<ApprovalDocument> cancelDocuments = documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester,
            "N",
            LEAVE_CANCEL_TEMPLATE_CODE,
            ApprovalDocument.STATUS_APPROVED
        );
        Map<String, LeaveUsageSelectionResponse> canceledDates = new LinkedHashMap<>();
        for (ApprovalDocument document : cancelDocuments) {
            if (excludeApprovalId != null && excludeApprovalId.equals(document.getApprovalId())) {
                continue;
            }
            for (LeaveUsageSelectionResponse selection : selectionsFrom(document)) {
                canceledDates.put(selection.date(), selection);
            }
        }
        List<LeaveUsageSelectionResponse> selections = new ArrayList<>();
        BigDecimal annualDays = BigDecimal.ZERO;
        for (ApprovalDocument document : leaveDocuments) {
            if (excludeApprovalId != null && excludeApprovalId.equals(document.getApprovalId())) {
                continue;
            }
            for (LeaveUsageSelectionResponse selection : selectionsFrom(document)) {
                if (canceledDates.containsKey(selection.date())) {
                    continue;
                }
                selections.add(selection);
                annualDays = annualDays.add(daysFor(selection.type()));
            }
        }
        BigDecimal totalAnnualDays = annualLeaveService.totalDays(requester, java.time.LocalDate.now().getYear());
        BigDecimal remainingAnnualDays = totalAnnualDays.subtract(annualDays);
        selections.sort(java.util.Comparator.comparing(LeaveUsageSelectionResponse::date));
        return new LeaveUsageResponse(formatDay(annualDays), formatDay(totalAnnualDays), formatDay(remainingAnnualDays), selections);
    }

    private List<LeaveUsageSelectionResponse> selectionsFrom(ApprovalDocument document) {
        return selectionsFrom(document.getFormDataJson(), document.getApprovalId(), document.getDocumentNo());
    }

    private List<LeaveUsageSelectionResponse> selectionsFrom(String formDataJson, Long approvalId, String documentNo) {
        JsonNode fields = formFields(formDataJson);
        JsonNode rawSelections = fields.path("leaveSelectionsJson");
        if (rawSelections.isMissingNode() || rawSelections.asText("").isBlank()) {
            return fallbackSelection(approvalId, documentNo, fields);
        }
        try {
            JsonNode parsed = objectMapper.readTree(rawSelections.asText());
            if (!parsed.isArray()) {
                return List.of();
            }
            List<LeaveUsageSelectionResponse> selections = new ArrayList<>();
            for (JsonNode node : parsed) {
                String date = node.path("date").asText("");
                if (date.isBlank()) {
                    continue;
                }
                String type = normalizedType(node.path("type").asText("연차"));
                selections.add(new LeaveUsageSelectionResponse(
                    date,
                    type,
                    formatDay(daysFor(type)),
                    approvalId,
                    documentNo
                ));
            }
            return selections;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private List<LeaveUsageSelectionResponse> fallbackSelection(Long approvalId, String documentNo, JsonNode fields) {
        String startDate = fields.path("startDate").asText("");
        if (startDate.isBlank()) {
            return List.of();
        }
        String type = normalizedType(fields.path("leaveType").asText("연차"));
        return List.of(new LeaveUsageSelectionResponse(
            startDate,
            type,
            formatDay(daysFor(type)),
            approvalId,
            documentNo
        ));
    }

    private JsonNode formFields(String formDataJson) {
        if (formDataJson == null || formDataJson.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            JsonNode root = objectMapper.readTree(formDataJson);
            return root.path("fields");
        } catch (Exception ex) {
            return objectMapper.createObjectNode();
        }
    }

    private String normalizedType(String value) {
        return value == null || value.isBlank() ? "연차" : value.trim();
    }

    private BigDecimal daysFor(String type) {
        if ("연차".equals(type)) {
            return BigDecimal.ONE;
        }
        if ("오전반차".equals(type) || "오후반차".equals(type)) {
            return new BigDecimal("0.5");
        }
        return BigDecimal.ZERO;
    }

    private String formatDay(BigDecimal value) {
        return value.setScale(1, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }

}
