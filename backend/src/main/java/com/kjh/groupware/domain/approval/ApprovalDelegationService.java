package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.ApprovalDelegationRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalDelegationResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalDelegationService {

    private static final String TRAINING_REQUEST_TEMPLATE_CODE = "TRAINING_REQUEST";
    private static final String TRAINING_REPORT_TEMPLATE_CODE = "TRAINING_REPORT";
    private static final Pattern DATE_PATTERN = Pattern.compile("\\d{4}-\\d{2}-\\d{2}");

    private final ApprovalDelegationRepository delegationRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public ApprovalDelegationResponse getMine() {
        Emp owner = currentEmpProvider.getCurrentEmp();
        return delegationRepository.findTopByOwnerEmpAndDelegationTypeAndDeletedYnOrderByDelegationIdDesc(
                owner,
                ApprovalDelegation.TYPE_DEFAULT,
                "N"
            )
            .map(ApprovalDelegationResponse::from)
            .orElse(null);
    }

    @Transactional
    public ApprovalDelegationResponse saveMine(ApprovalDelegationRequest request, String ipAddress, String userAgent) {
        if (request == null || request.delegateEmpId() == null) {
            throw BusinessException.badRequest("APPROVAL_DELEGATE_REQUIRED", "기본 대리자를 선택해 주세요.");
        }
        Emp owner = currentEmpProvider.getCurrentEmp();
        Emp delegate = empRepository.findById(request.delegateEmpId())
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_DELEGATE_NOT_FOUND", "기본 대리자를 찾을 수 없습니다."));
        validate(owner, delegate, null, null);

        ApprovalDelegation delegation = delegationRepository.findTopByOwnerEmpAndDelegationTypeAndDeletedYnOrderByDelegationIdDesc(
                owner,
                ApprovalDelegation.TYPE_DEFAULT,
                "N"
            )
            .orElseGet(() -> delegationRepository.save(ApprovalDelegation.builder()
                .ownerEmp(owner)
                .delegateEmp(delegate)
                .startDate(LocalDate.now())
                .delegationType(ApprovalDelegation.TYPE_DEFAULT)
                .reason(request.reason())
                .activeYn("Y")
                .build()));
        delegation.updateDefault(delegate, request.reason());
        auditLogService.record(owner.getEmpId(), AuditActionType.SET_DELEGATION, "approval_delegation", delegation.getDelegationId(), ipAddress, userAgent);
        return ApprovalDelegationResponse.from(delegation);
    }

    @Transactional
    public void deleteMine(String ipAddress, String userAgent) {
        Emp owner = currentEmpProvider.getCurrentEmp();
        ApprovalDelegation delegation = delegationRepository.findTopByOwnerEmpAndDelegationTypeAndDeletedYnOrderByDelegationIdDesc(
                owner,
                ApprovalDelegation.TYPE_DEFAULT,
                "N"
            )
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_DELEGATION_NOT_FOUND", "설정된 기본 대리자가 없습니다."));
        delegation.delete();
        auditLogService.record(owner.getEmpId(), AuditActionType.CANCEL_DELEGATION, "approval_delegation", delegation.getDelegationId(), ipAddress, userAgent);
    }

    @Transactional(readOnly = true)
    public List<Emp> decisionAssigneesFor(Emp actor) {
        List<Emp> assignees = new ArrayList<>();
        if (actor == null) {
            return assignees;
        }
        assignees.add(actor);
        LocalDateTime now = LocalDateTime.now();
        delegationRepository.findActiveByDelegateAt(actor, now, now.toLocalDate()).stream()
            .map(ApprovalDelegation::getOwnerEmp)
            .filter(owner -> owner != null)
            .filter(owner -> assignees.stream().noneMatch(saved -> saved.getEmpId().equals(owner.getEmpId())))
            .forEach(assignees::add);
        return assignees;
    }

    @Transactional(readOnly = true)
    public boolean canActFor(Emp actor, Emp owner) {
        if (actor == null || owner == null) {
            return false;
        }
        if (actor.getEmpId().equals(owner.getEmpId())) {
            return true;
        }
        LocalDateTime now = LocalDateTime.now();
        return delegationRepository.findActiveByOwnerAndDelegateAt(owner, actor, now, now.toLocalDate()).isPresent();
    }

    @Transactional(readOnly = true)
    public List<Emp> activeDelegatesFor(Emp owner) {
        if (owner == null) {
            return List.of();
        }
        LocalDateTime now = LocalDateTime.now();
        return delegationRepository.findActiveByOwnerAt(owner, now, now.toLocalDate()).stream()
            .map(ApprovalDelegation::getDelegateEmp)
            .filter(delegate -> delegate != null && delegate.isActiveUser())
            .distinct()
            .toList();
    }

    @Transactional
    public void applyAutoDelegationForAbsenceDocument(Emp owner, ApprovalDocument document, String formDataJson) {
        if (owner == null || document == null || !isAbsenceTemplate(document.getTemplateCode()) || !delegationEnabled(formDataJson)) {
            return;
        }
        ApprovalDelegation defaultDelegation = delegationRepository.findTopByOwnerEmpAndDelegationTypeAndDeletedYnOrderByDelegationIdDesc(
                owner,
                ApprovalDelegation.TYPE_DEFAULT,
                "N"
            )
            .orElseThrow(() -> BusinessException.badRequest(
                "APPROVAL_DEFAULT_DELEGATE_REQUIRED",
                "대리결재를 적용하려면 먼저 기본 대리자를 지정해 주세요."
            ));
        List<DelegationWindow> windows = absenceWindows(document.getTemplateCode(), formDataJson);
        if (windows.isEmpty()) {
            throw BusinessException.badRequest(
                "APPROVAL_DELEGATION_PERIOD_REQUIRED",
                "대리결재를 적용하려면 휴가 또는 교육 기간을 입력해 주세요."
            );
        }
        for (DelegationWindow window : windows) {
            delegationRepository.save(ApprovalDelegation.builder()
                .ownerEmp(owner)
                .delegateEmp(defaultDelegation.getDelegateEmp())
                .startDate(window.start().toLocalDate())
                .endDate(window.end().minusNanos(1).toLocalDate())
                .startAt(window.start())
                .endAt(window.end())
                .delegationType(ApprovalDelegation.TYPE_AUTO)
                .sourceApproval(document)
                .reason("AUTO_ABSENCE")
                .activeYn("Y")
                .build());
        }
    }

    private void validate(Emp owner, Emp delegate, LocalDate startDate, LocalDate endDate) {
        if (owner.getEmpId().equals(delegate.getEmpId())) {
            throw BusinessException.badRequest("APPROVAL_DELEGATE_SELF", "본인은 기본 대리자로 지정할 수 없습니다.");
        }
        if (!delegate.isActiveUser()) {
            throw BusinessException.badRequest("APPROVAL_DELEGATE_INACTIVE", "재직 중인 사용자만 기본 대리자로 지정할 수 있습니다.");
        }
        LocalDate safeStart = safeStartDate(startDate);
        if (endDate != null && endDate.isBefore(safeStart)) {
            throw BusinessException.badRequest("APPROVAL_DELEGATION_INVALID_PERIOD", "대리 종료일은 시작일보다 빠를 수 없습니다.");
        }
    }

    private LocalDate safeStartDate(LocalDate startDate) {
        return startDate == null ? LocalDate.now() : startDate;
    }

    private boolean isAbsenceTemplate(String templateCode) {
        return ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE.equals(templateCode)
            || TRAINING_REQUEST_TEMPLATE_CODE.equals(templateCode)
            || TRAINING_REPORT_TEMPLATE_CODE.equals(templateCode);
    }

    private boolean delegationEnabled(String formDataJson) {
        JsonNode fields = fieldsNode(formDataJson);
        String value = fields.path("approvalDelegationEnabled").asText("");
        return "Y".equalsIgnoreCase(value) || "true".equalsIgnoreCase(value);
    }

    private List<DelegationWindow> absenceWindows(String templateCode, String formDataJson) {
        JsonNode fields = fieldsNode(formDataJson);
        if (ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE.equals(templateCode)) {
            return leaveWindows(fields.path("leaveSelectionsJson").asText(""));
        }
        return trainingWindows(fields);
    }

    private List<DelegationWindow> leaveWindows(String selectionsJson) {
        if (selectionsJson == null || selectionsJson.isBlank()) {
            return List.of();
        }
        try {
            JsonNode selections = objectMapper.readTree(selectionsJson);
            List<DelegationWindow> windows = new ArrayList<>();
            if (!selections.isArray()) {
                return windows;
            }
            for (JsonNode selection : selections) {
                String dateValue = selection.path("date").asText("");
                if (dateValue.isBlank()) {
                    continue;
                }
                LocalDate date = LocalDate.parse(dateValue);
                String type = selection.path("type").asText("");
                if (type.contains("오전") || type.toUpperCase().contains("AM")) {
                    windows.add(new DelegationWindow(date.atTime(8, 0), date.atTime(12, 0)));
                } else if (type.contains("오후") || type.toUpperCase().contains("PM")) {
                    windows.add(new DelegationWindow(date.atTime(13, 0), date.atTime(18, 0)));
                } else {
                    windows.add(new DelegationWindow(date.atStartOfDay(), date.plusDays(1).atStartOfDay()));
                }
            }
            return windows;
        } catch (Exception ex) {
            throw BusinessException.badRequest("APPROVAL_LEAVE_SELECTION_INVALID", "휴가 선택 기간을 확인해 주세요.");
        }
    }

    private List<DelegationWindow> trainingWindows(JsonNode fields) {
        String startValue = fields.path("trainingStartDate").asText("");
        String endValue = fields.path("trainingEndDate").asText("");
        if (startValue.isBlank() || endValue.isBlank()) {
            List<LocalDate> parsed = parseDates(fields.path("trainingPeriod").asText(""));
            if (!parsed.isEmpty()) {
                startValue = parsed.get(0).toString();
                endValue = parsed.size() > 1 ? parsed.get(1).toString() : startValue;
            }
        }
        if (startValue.isBlank() || endValue.isBlank()) {
            return List.of();
        }
        LocalDate start = LocalDate.parse(startValue);
        LocalDate end = LocalDate.parse(endValue);
        if (end.isBefore(start)) {
            throw BusinessException.badRequest("APPROVAL_TRAINING_PERIOD_INVALID", "교육 종료일은 시작일보다 빠를 수 없습니다.");
        }
        return List.of(new DelegationWindow(start.atStartOfDay(), end.plusDays(1).atStartOfDay()));
    }

    private List<LocalDate> parseDates(String text) {
        List<LocalDate> dates = new ArrayList<>();
        Matcher matcher = DATE_PATTERN.matcher(text == null ? "" : text);
        while (matcher.find()) {
            dates.add(LocalDate.parse(matcher.group()));
        }
        return dates;
    }

    private JsonNode fieldsNode(String formDataJson) {
        if (formDataJson == null || formDataJson.isBlank()) {
            return objectMapper.createObjectNode();
        }
        try {
            JsonNode root = objectMapper.readTree(formDataJson);
            JsonNode fields = root.path("fields");
            return fields.isObject() ? fields : root;
        } catch (Exception ex) {
            throw BusinessException.badRequest("APPROVAL_FORM_INVALID_JSON", "Approval form data JSON is invalid");
        }
    }

    private record DelegationWindow(LocalDateTime start, LocalDateTime end) {
        private DelegationWindow {
            if (!end.isAfter(start)) {
                end = LocalDateTime.of(start.toLocalDate(), LocalTime.MAX);
            }
        }
    }
}
