package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalDefaultLineRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalDefaultLineRenameRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalDefaultLineResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalDefaultLineStepRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalDefaultLineStepResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalDefaultLineService {

    private static final String RECENT_LINE_NAME = "\uCD5C\uADFC \uC0AC\uC6A9 \uACB0\uC7AC\uC120";

    private static final Set<String> ALLOWED_LINE_TYPES = Set.of(
        ApprovalLine.TYPE_AGREEMENT,
        ApprovalLine.TYPE_APPROVAL,
        ApprovalLine.TYPE_RECEIVER,
        ApprovalLine.TYPE_REFERENCE,
        ApprovalLine.TYPE_READER
    );

    private final ApprovalDefaultLineRepository defaultLineRepository;
    private final ApprovalDefaultLineStepRepository stepRepository;
    private final EmpRepository empRepository;
    private final ApprovalTemplateRepository templateRepository;
    private final CurrentEmpProvider currentEmpProvider;

    @Transactional(readOnly = true)
    public ApprovalDefaultLineResponse effective(String templateCode) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDefaultLine personalLine = activePersonalLine(currentEmp);
        if (personalLine != null) {
            return response(personalLine, ApprovalDefaultLine.TYPE_PERSONAL);
        }
        ApprovalDefaultLine templateLine = activeTemplateLine(templateCode);
        if (templateLine != null) {
            return response(templateLine, ApprovalDefaultLine.TYPE_TEMPLATE);
        }
        return ApprovalDefaultLineResponse.empty();
    }

    @Transactional(readOnly = true)
    public ApprovalDefaultLineResponse template(String templateCode) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        requireApprovalAdmin(currentEmp);
        ApprovalDefaultLine templateLine = activeTemplateLine(templateCode);
        return templateLine == null ? ApprovalDefaultLineResponse.empty() : response(templateLine, ApprovalDefaultLine.TYPE_TEMPLATE);
    }

    @Transactional(readOnly = true)
    public List<ApprovalDefaultLineResponse> listPersonal() {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        return defaultLineRepository.findByOwnerAndDefaultTypeAndDeletedYnOrderBySortOrderAscDefaultLineIdDesc(
                currentEmp,
                ApprovalDefaultLine.TYPE_PERSONAL,
                "N"
            ).stream()
            .filter(line -> "Y".equals(line.getActiveYn()))
            .filter(line -> !"최근 사용 결재선".equals(line.getLineName()))
            .map(line -> response(line, ApprovalDefaultLine.TYPE_PERSONAL))
            .toList();
    }

    @Transactional
    public ApprovalDefaultLineResponse savePersonal(ApprovalDefaultLineRequest request) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        validateSteps(request.steps());

        if (RECENT_LINE_NAME.equals(request.lineName())) {
            return saveRecentPersonal(currentEmp, request);
        }

        ApprovalDefaultLine saved = defaultLineRepository.save(ApprovalDefaultLine.builder()
            .owner(currentEmp)
            .lineName(request.lineName())
            .defaultType(ApprovalDefaultLine.TYPE_PERSONAL)
            .activeYn("Y")
            .sortOrder(0)
            .deletedYn("N")
            .build());
        saveSteps(saved, request.steps());
        return response(saved, ApprovalDefaultLine.TYPE_PERSONAL);
    }

    private ApprovalDefaultLineResponse saveRecentPersonal(Emp currentEmp, ApprovalDefaultLineRequest request) {
        List<ApprovalDefaultLine> lines = defaultLineRepository
            .findByOwnerAndDefaultTypeAndLineNameAndDeletedYnOrderBySortOrderAscDefaultLineIdDesc(
                currentEmp,
                ApprovalDefaultLine.TYPE_PERSONAL,
                RECENT_LINE_NAME,
                "N"
            );
        ApprovalDefaultLine saved = lines.isEmpty()
            ? defaultLineRepository.save(ApprovalDefaultLine.builder()
                .owner(currentEmp)
                .lineName(RECENT_LINE_NAME)
                .defaultType(ApprovalDefaultLine.TYPE_PERSONAL)
                .activeYn("Y")
                .sortOrder(0)
                .deletedYn("N")
                .build())
            : lines.get(0);
        saved.activate();
        for (int index = 1; index < lines.size(); index++) {
            lines.get(index).delete();
        }
        stepRepository.deleteByDefaultLine(saved);
        saveSteps(saved, request.steps());
        return response(saved, ApprovalDefaultLine.TYPE_PERSONAL);
    }

    @Transactional
    public ApprovalDefaultLineResponse renamePersonal(Long defaultLineId, ApprovalDefaultLineRenameRequest request) {
        ApprovalDefaultLine line = personalLineForUpdate(defaultLineId);
        if (request.lineName() == null || request.lineName().isBlank()) {
            throw BusinessException.badRequest("DEFAULT_LINE_NAME_REQUIRED", "Default approval line name is required");
        }
        line.rename(request.lineName());
        return response(line, ApprovalDefaultLine.TYPE_PERSONAL);
    }

    @Transactional
    public void deletePersonal(Long defaultLineId) {
        ApprovalDefaultLine line = personalLineForUpdate(defaultLineId);
        line.delete();
    }

    @Transactional
    public ApprovalDefaultLineResponse saveTemplate(String templateCode, ApprovalDefaultLineRequest request) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        requireApprovalAdmin(currentEmp);
        if (templateCode == null || templateCode.isBlank()) {
            throw BusinessException.badRequest("TEMPLATE_CODE_REQUIRED", "Template code is required");
        }
        templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(templateCode, "Y")
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_TEMPLATE_NOT_FOUND", "Active approval template was not found"));
        validateSteps(request.steps());
        defaultLineRepository.findByDefaultTypeAndTemplateCodeAndActiveYnAndDeletedYnOrderBySortOrderAscDefaultLineIdDesc(
            ApprovalDefaultLine.TYPE_TEMPLATE,
            templateCode,
            "Y",
            "N"
        ).forEach(ApprovalDefaultLine::deactivate);

        ApprovalDefaultLine saved = defaultLineRepository.save(ApprovalDefaultLine.builder()
            .templateCode(templateCode)
            .lineName(request.lineName())
            .defaultType(ApprovalDefaultLine.TYPE_TEMPLATE)
            .activeYn("Y")
            .sortOrder(0)
            .deletedYn("N")
            .build());
        saveSteps(saved, request.steps());
        return response(saved, ApprovalDefaultLine.TYPE_TEMPLATE);
    }

    private ApprovalDefaultLine activeTemplateLine(String templateCode) {
        if (templateCode == null || templateCode.isBlank()) {
            return null;
        }
        List<ApprovalDefaultLine> lines = defaultLineRepository
            .findByDefaultTypeAndTemplateCodeAndActiveYnAndDeletedYnOrderBySortOrderAscDefaultLineIdDesc(
                ApprovalDefaultLine.TYPE_TEMPLATE,
                templateCode,
                "Y",
                "N"
            );
        return lines.isEmpty() ? null : lines.get(0);
    }

    private ApprovalDefaultLine activePersonalLine(Emp owner) {
        List<ApprovalDefaultLine> lines = defaultLineRepository
            .findByOwnerAndDefaultTypeAndActiveYnAndDeletedYnOrderBySortOrderAscDefaultLineIdDesc(
                owner,
                ApprovalDefaultLine.TYPE_PERSONAL,
                "Y",
                "N"
            );
        return lines.isEmpty() ? null : lines.get(0);
    }

    private ApprovalDefaultLine personalLineForUpdate(Long defaultLineId) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDefaultLine line = defaultLineRepository.findById(defaultLineId)
            .orElseThrow(() -> BusinessException.notFound("DEFAULT_LINE_NOT_FOUND", "Default approval line was not found"));
        if (!ApprovalDefaultLine.TYPE_PERSONAL.equals(line.getDefaultType())
            || line.getOwner() == null
            || !line.getOwner().getEmpId().equals(currentEmp.getEmpId())
            || "Y".equals(line.getDeletedYn())) {
            throw BusinessException.forbidden("DEFAULT_LINE_FORBIDDEN", "You cannot manage this default approval line");
        }
        if ("최근 사용 결재선".equals(line.getLineName())) {
            throw BusinessException.forbidden("DEFAULT_LINE_SYSTEM_RESERVED", "Recent approval line cannot be managed manually");
        }
        return line;
    }

    private void saveSteps(ApprovalDefaultLine defaultLine, List<ApprovalDefaultLineStepRequest> steps) {
        int order = 1;
        for (ApprovalDefaultLineStepRequest step : steps) {
            Emp approver = empRepository.findById(step.approverEmpId())
                .orElseThrow(() -> BusinessException.notFound("APPROVER_NOT_FOUND", "Approver was not found"));
            if (!approver.isActiveUser()) {
                throw BusinessException.badRequest(
                    "DEFAULT_LINE_ASSIGNEE_INACTIVE",
                    "재직 중인 사용자만 기본 결재선에 지정할 수 있습니다: " + approver.getEmpName()
                );
            }
            String lineType = normalizeLineType(step.lineType());
            stepRepository.save(ApprovalDefaultLineStep.builder()
                .defaultLine(defaultLine)
                .stepOrder(step.stepOrder() == null ? order : step.stepOrder())
                .approver(approver)
                .lineType(lineType)
                .required(step.required())
                .deletedYn("N")
                .build());
            order++;
        }
    }

    private void validateSteps(List<ApprovalDefaultLineStepRequest> steps) {
        if (steps == null || steps.isEmpty()) {
            throw BusinessException.badRequest("DEFAULT_LINE_EMPTY", "At least one default approval line step is required");
        }
        Set<String> unique = new HashSet<>();
        boolean hasApprover = false;
        for (ApprovalDefaultLineStepRequest step : steps) {
            if (step.approverEmpId() == null) {
                throw BusinessException.badRequest("DEFAULT_LINE_ASSIGNEE_REQUIRED", "Default approval line assignee is required");
            }
            String lineType = normalizeLineType(step.lineType());
            if (ApprovalLine.TYPE_APPROVAL.equals(lineType)) {
                hasApprover = true;
            }
            String key = lineType + ":" + step.approverEmpId();
            if (!unique.add(key)) {
                throw BusinessException.badRequest("DEFAULT_LINE_DUPLICATED", "Default approval line contains duplicated assignees");
            }
        }
        if (!hasApprover) {
            throw BusinessException.badRequest("DEFAULT_LINE_NO_APPROVER", "Default approval line must include at least one approver");
        }
    }

    private String normalizeLineType(String lineType) {
        String normalized = lineType == null || lineType.isBlank() ? ApprovalLine.TYPE_APPROVAL : lineType;
        if (!ALLOWED_LINE_TYPES.contains(normalized)) {
            throw BusinessException.badRequest("DEFAULT_LINE_INVALID_TYPE", "Invalid default approval line type");
        }
        return normalized;
    }

    private void requireApprovalAdmin(Emp currentEmp) {
        if (!"ADMIN".equals(currentEmp.getRoleCode()) && !"APPROVAL_ADMIN".equals(currentEmp.getRoleCode())) {
            throw BusinessException.forbidden("DEFAULT_LINE_FORBIDDEN", "Only approval admins can manage template default approval lines");
        }
    }

    private ApprovalDefaultLineResponse response(ApprovalDefaultLine defaultLine, String source) {
        return ApprovalDefaultLineResponse.from(
            defaultLine,
            source,
            stepRepository.findByDefaultLineAndDeletedYnOrderByStepOrderAscDefaultLineStepIdAsc(defaultLine, "N").stream()
                .map(ApprovalDefaultLineStepResponse::from)
                .toList()
        );
    }
}
