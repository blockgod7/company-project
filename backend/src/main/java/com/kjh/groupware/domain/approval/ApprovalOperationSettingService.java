package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalOperationSettingRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalOperationSettingResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalOperationSettingService {

    private static final long DEFAULT_DELETED_DOCUMENT_RETENTION_DAYS = 1825;
    private static final boolean DEFAULT_PERMANENT_DELETE_ENABLED = false;
    private static final List<String> MANAGED_KEYS = List.of(
        ApprovalOperationSetting.KEY_DECISION_DUE_HOURS,
        ApprovalOperationSetting.KEY_REMINDER_FIXED_DELAY_MS,
        ApprovalOperationSetting.KEY_DELETED_DOCUMENT_RETENTION_DAYS,
        ApprovalOperationSetting.KEY_PERMANENT_DELETE_ENABLED
    );

    private final ApprovalOperationSettingRepository settingRepository;
    private final ApprovalOperationProperties operationProperties;
    private final ApprovalPermissionService permissionService;
    private final CurrentEmpProvider currentEmpProvider;

    @Transactional(readOnly = true)
    public ApprovalOperationSettingResponse current() {
        Map<String, String> values = settingRepository.findBySettingKeyIn(MANAGED_KEYS).stream()
            .collect(Collectors.toMap(ApprovalOperationSetting::getSettingKey, ApprovalOperationSetting::getSettingValue));
        return new ApprovalOperationSettingResponse(
            positiveLong(values.get(ApprovalOperationSetting.KEY_DECISION_DUE_HOURS), operationProperties.decisionDueHours()),
            positiveLong(values.get(ApprovalOperationSetting.KEY_REMINDER_FIXED_DELAY_MS), operationProperties.reminderFixedDelayMs()),
            positiveLong(values.get(ApprovalOperationSetting.KEY_DELETED_DOCUMENT_RETENTION_DAYS), DEFAULT_DELETED_DOCUMENT_RETENTION_DAYS),
            booleanValue(values.get(ApprovalOperationSetting.KEY_PERMANENT_DELETE_ENABLED), DEFAULT_PERMANENT_DELETE_ENABLED),
            operationProperties.decisionDueHours(),
            operationProperties.reminderFixedDelayMs(),
            DEFAULT_DELETED_DOCUMENT_RETENTION_DAYS,
            DEFAULT_PERMANENT_DELETE_ENABLED
        );
    }

    @Transactional(readOnly = true)
    public ApprovalOperationSettingResponse currentForAdmin() {
        requireOperationAdmin();
        return current();
    }

    @Transactional
    public ApprovalOperationSettingResponse update(ApprovalOperationSettingRequest request) {
        requireOperationAdmin();
        upsert(
            ApprovalOperationSetting.KEY_DECISION_DUE_HOURS,
            String.valueOf(request.decisionDueHours()),
            "결재/합의 라인이 열린 뒤 처리 기한까지의 시간"
        );
        upsert(
            ApprovalOperationSetting.KEY_REMINDER_FIXED_DELAY_MS,
            String.valueOf(request.reminderFixedDelayMs()),
            "지연 알림 스캔 최소 실행 간격(ms)"
        );
        upsert(
            ApprovalOperationSetting.KEY_DELETED_DOCUMENT_RETENTION_DAYS,
            String.valueOf(request.deletedDocumentRetentionDays()),
            "보존삭제 문서를 영구보존 검토 전까지 보관할 최소 일수"
        );
        upsert(
            ApprovalOperationSetting.KEY_PERMANENT_DELETE_ENABLED,
            String.valueOf(request.permanentDeleteEnabled()),
            "전자결재 영구삭제 실행 허용 여부"
        );
        return current();
    }

    @Transactional(readOnly = true)
    public long decisionDueHours() {
        return current().decisionDueHours();
    }

    @Transactional(readOnly = true)
    public long reminderFixedDelayMs() {
        return current().reminderFixedDelayMs();
    }

    private void upsert(String key, String value, String description) {
        ApprovalOperationSetting setting = settingRepository.findById(key)
            .orElseGet(() -> new ApprovalOperationSetting(key, value, description));
        setting.updateValue(value);
        settingRepository.save(setting);
    }

    private void requireOperationAdmin() {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        if (!permissionService.canManageOperations(currentEmp)) {
            throw BusinessException.forbidden("APPROVAL_OPERATION_SETTING_FORBIDDEN", "전자결재 운영 설정 권한이 없습니다.");
        }
    }

    private long positiveLong(String value, long fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        try {
            long parsed = Long.parseLong(value);
            return parsed > 0 ? parsed : fallback;
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private boolean booleanValue(String value, boolean fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        return "true".equalsIgnoreCase(value) || "Y".equalsIgnoreCase(value)
            ? true
            : "false".equalsIgnoreCase(value) || "N".equalsIgnoreCase(value)
                ? false
                : fallback;
    }
}
