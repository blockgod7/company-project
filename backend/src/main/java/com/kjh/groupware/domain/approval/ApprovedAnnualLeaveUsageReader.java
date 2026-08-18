package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.LeaveUsageSelectionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.exception.BusinessException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class ApprovedAnnualLeaveUsageReader {

    private static final String LEAVE_TEMPLATE_CODE = "LEAVE";
    private static final String LEAVE_CANCEL_TEMPLATE_CODE = "LEAVE_CANCEL";

    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLeaveExclusionRepository exclusionRepository;
    private final ApprovalLeaveLifecycleCancellationRepository lifecycleCancellationRepository;
    private final LeavePolicyService leavePolicyService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public BigDecimal approvedAnnualDays(Emp requester, int balanceYear) {
        List<ApprovalDocument> leaveDocuments = documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", LEAVE_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        );
        List<ApprovalDocument> cancelDocuments = documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(
            requester, "N", LEAVE_CANCEL_TEMPLATE_CODE, ApprovalDocument.STATUS_APPROVED
        );

        Set<String> canceledTargets = new HashSet<>();
        Set<String> legacyCanceledSelections = new HashSet<>();
        for (ApprovalDocument document : cancelDocuments) {
            for (LeaveUsageSelectionResponse selection : selectionsFor(document)) {
                if (selection.approvalId() == null) {
                    legacyCanceledSelections.add(selectionKey(selection));
                } else {
                    canceledTargets.add(targetSelectionKey(selection.approvalId(), selection));
                }
            }
        }

        Set<String> excludedDates = exclusionRepository.findByDocumentRequesterOrderByLeaveDateAsc(requester).stream()
            .filter(ApprovalLeaveExclusion::isActive)
            .map(item -> item.getDocument().getApprovalId() + "|" + item.getLeaveDate())
            .collect(Collectors.toSet());
        Set<String> lifecycleCanceledSelections = lifecycleCancellationRepository.findByEmpAndActiveYn(requester, "Y").stream()
            .map(item -> item.getDocument().getApprovalId() + "|" + item.getLeaveDate() + "|" + item.getLeaveType())
            .collect(Collectors.toSet());

        BigDecimal usedDays = BigDecimal.ZERO;
        for (ApprovalDocument document : leaveDocuments) {
            for (LeaveUsageSelectionResponse selection : selectionsFor(document)) {
                LocalDate date = parseDate(selection.date());
                if (date.getYear() != balanceYear) {
                    continue;
                }
                if (lifecycleCanceledSelections.contains(document.getApprovalId() + "|" + selection.date() + "|" + selection.type())) {
                    continue;
                }
                if (excludedDates.contains(document.getApprovalId() + "|" + selection.date())) {
                    continue;
                }
                if (canceledTargets.contains(targetSelectionKey(document.getApprovalId(), selection))
                    || legacyCanceledSelections.contains(selectionKey(selection))) {
                    continue;
                }
                usedDays = usedDays.add(daysFor(selection.type(), date));
            }
        }
        return usedDays;
    }

    private List<LeaveUsageSelectionResponse> selectionsFor(ApprovalDocument document) {
        boolean sourceReferences = LEAVE_CANCEL_TEMPLATE_CODE.equals(document.getTemplateCode());
        JsonNode fields = formFields(document.getFormDataJson());
        JsonNode rawSelections = fields.path("leaveSelectionsJson");
        if (rawSelections.isMissingNode() || rawSelections.asText("").isBlank()) {
            return fallbackSelection(
                sourceReferences ? null : document.getApprovalId(),
                sourceReferences ? null : document.getDocumentNo(),
                fields
            );
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
                Long approvalId = sourceReferences ? positiveLong(node.path("sourceApprovalId")) : document.getApprovalId();
                String sourceDocumentNo = node.path("sourceDocumentNo").asText("").trim();
                String documentNo = sourceReferences
                    ? (sourceDocumentNo.isBlank() ? null : sourceDocumentNo)
                    : document.getDocumentNo();
                selections.add(new LeaveUsageSelectionResponse(
                    date, type, formatDay(daysFor(type, parseDate(date))), approvalId, documentNo
                ));
            }
            return selections;
        } catch (Exception exception) {
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
            startDate, type, formatDay(daysFor(type, parseDate(startDate))), approvalId, documentNo
        ));
    }

    private JsonNode formFields(String formDataJson) {
        if (formDataJson == null || formDataJson.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            return objectMapper.readTree(formDataJson).path("fields");
        } catch (Exception exception) {
            return objectMapper.createObjectNode();
        }
    }

    private BigDecimal daysFor(String type, LocalDate date) {
        LeavePolicy policy = leavePolicyService.resolve(type, date);
        if (policy != null) {
            return policy.getAnnualDeductionDays();
        }
        if ("연차".equals(type) || "하계휴가".equals(type)) {
            return BigDecimal.ONE;
        }
        if ("오전반차".equals(type) || "오후반차".equals(type)) {
            return new BigDecimal("0.5");
        }
        return BigDecimal.ZERO;
    }

    private LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException exception) {
            throw BusinessException.badRequest("LEAVE_DATE_INVALID", "휴가 날짜 형식을 확인해 주세요: " + value);
        }
    }

    private Long positiveLong(JsonNode node) {
        if (node == null || !node.canConvertToLong()) {
            return null;
        }
        long value = node.asLong();
        return value > 0 ? value : null;
    }

    private String normalizedType(String value) {
        return value == null || value.isBlank() ? "연차" : value.trim();
    }

    private String selectionKey(LeaveUsageSelectionResponse selection) {
        return selection.date() + "|" + selection.type();
    }

    private String targetSelectionKey(Long approvalId, LeaveUsageSelectionResponse selection) {
        return (approvalId == null ? "legacy" : approvalId) + "|" + selectionKey(selection);
    }

    private String formatDay(BigDecimal value) {
        return value.setScale(1, RoundingMode.HALF_UP).stripTrailingZeros().toPlainString();
    }
}
