package com.kjh.groupware.domain.approval;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.ApprovalTemplateRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalTemplateResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalTemplateService {

    private final ApprovalTemplateRepository templateRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<ApprovalTemplateResponse> latestActive() {
        return templateRepository.findLatestActiveTemplates().stream()
            .map(ApprovalTemplateResponse::from)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<ApprovalTemplateResponse> latestForAdmin() {
        requireAdmin();
        return templateRepository.findLatestTemplates().stream()
            .map(ApprovalTemplateResponse::from)
            .toList();
    }

    @Transactional
    public ApprovalTemplateResponse saveNewVersion(ApprovalTemplateRequest request) {
        requireAdmin();
        validateJson(request.fieldsJson(), "fieldsJson");
        if (request.printLayoutJson() != null && !request.printLayoutJson().isBlank()) {
            validateJson(request.printLayoutJson(), "printLayoutJson");
        }

        String templateCode = request.templateCode().trim().toUpperCase();
        int nextVersion = templateRepository.findTopByTemplateCodeOrderByVersionDesc(templateCode)
            .map(template -> template.getVersion() + 1)
            .orElse(1);
        templateRepository.findByTemplateCodeAndActiveYn(templateCode, "Y")
            .forEach(ApprovalTemplate::deactivate);

        ApprovalTemplate saved = templateRepository.save(ApprovalTemplate.builder()
            .templateCode(templateCode)
            .templateName(request.templateName().trim())
            .version(nextVersion)
            .description(blankToNull(request.description()))
            .fieldsJson(request.fieldsJson().trim())
            .printLayoutJson(blankToNull(request.printLayoutJson()))
            .activeYn(Boolean.FALSE.equals(request.active()) ? "N" : "Y")
            .sortOrder(request.sortOrder())
            .build());
        return ApprovalTemplateResponse.from(saved);
    }

    @Transactional
    public ApprovalTemplateResponse setActive(String templateCode, boolean active) {
        requireAdmin();
        ApprovalTemplate latest = templateRepository.findTopByTemplateCodeOrderByVersionDesc(templateCode)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_TEMPLATE_NOT_FOUND", "Approval template was not found"));
        if (active) {
            templateRepository.findByTemplateCodeAndActiveYn(latest.getTemplateCode(), "Y")
                .forEach(ApprovalTemplate::deactivate);
            latest.activate();
        } else {
            latest.deactivate();
        }
        return ApprovalTemplateResponse.from(latest);
    }

    private void requireAdmin() {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        if (!"ADMIN".equals(currentEmp.getRoleCode()) && !"APPROVAL_ADMIN".equals(currentEmp.getRoleCode())) {
            throw BusinessException.forbidden("ADMIN_REQUIRED", "Admin role is required");
        }
    }

    private void validateJson(String json, String fieldName) {
        try {
            objectMapper.readTree(json);
        } catch (Exception ex) {
            throw BusinessException.badRequest("APPROVAL_TEMPLATE_INVALID_JSON", fieldName + " must be valid JSON");
        }
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
