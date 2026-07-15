package com.kjh.groupware.domain.equipment;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalDraftService;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalResponse;
import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.domain.dept.DeptRepository;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.equipment.dto.EquipmentAssignmentRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentAssignmentAuthorityRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentAssignmentAuthorityResponse;
import com.kjh.groupware.domain.equipment.dto.EquipmentAssignmentPermissionResponse;
import com.kjh.groupware.domain.equipment.dto.EquipmentCompletionRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentHistoryResponse;
import com.kjh.groupware.domain.equipment.dto.EquipmentReportRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentReportResponse;
import com.kjh.groupware.domain.equipment.dto.EquipmentRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentResponse;
import com.kjh.groupware.domain.equipment.dto.EquipmentProcessRequest;
import com.kjh.groupware.domain.equipment.dto.EquipmentProcessResponse;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class EquipmentManagementService {
    public static final String REPORT_TEMPLATE = "EQUIPMENT_ABNORMAL_REPORT";
    public static final String COMPLETION_TEMPLATE = "EQUIPMENT_WORK_COMPLETION";
    private final EquipmentRepository equipmentRepository;
    private final EquipmentProcessRepository equipmentProcessRepository;
    private final EquipmentReportRepository reportRepository;
    private final EquipmentHistoryEventRepository historyRepository;
    private final EquipmentAssignmentAuthorityRepository assignmentAuthorityRepository;
    private final DeptRepository deptRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final ApprovalDraftService approvalDraftService;
    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<EquipmentResponse> equipments() {
        return equipmentRepository.findAllByOrderByEquipmentNoAsc().stream().map(EquipmentResponse::from).toList();
    }

    @Transactional
    public EquipmentResponse createEquipment(EquipmentRequest request) {
        requireAdmin(currentEmpProvider.getCurrentEmp());
        if (equipmentRepository.findByEquipmentNo(request.equipmentNo().trim()).isPresent()) {
            throw BusinessException.badRequest("EQUIPMENT_NO_DUPLICATED", "Equipment number already exists");
        }
        validateEquipment(request);
        Equipment equipment = new Equipment(request.equipmentNo().trim(), request.equipmentName().trim(), process(request.processId()), ownerDept(request), request.equipmentType().trim(), request.assetNo().trim(), request.modelName(), request.introducedYear(), request.introducedPrice(), request.manufacturer(), request.status());
        return EquipmentResponse.from(equipmentRepository.save(equipment));
    }

    @Transactional
    public EquipmentResponse updateEquipment(Long equipmentId, EquipmentRequest request) {
        requireAdmin(currentEmpProvider.getCurrentEmp());
        Equipment equipment = equipment(equipmentId);
        if (!equipment.getEquipmentNo().equals(request.equipmentNo().trim())) {
            throw BusinessException.badRequest("EQUIPMENT_NO_IMMUTABLE", "Equipment number cannot be changed");
        }
        validateEquipment(request);
        equipment.update(request.equipmentName().trim(), process(request.processId()), ownerDept(request), request.equipmentType().trim(), request.assetNo().trim(), request.modelName(), request.introducedYear(), request.introducedPrice(), request.manufacturer(), request.status());
        return EquipmentResponse.from(equipment);
    }

    @Transactional(readOnly = true)
    public List<EquipmentProcessResponse> processes() { return equipmentProcessRepository.findByUseYnOrderByProcessNameAsc("Y").stream().map(EquipmentProcessResponse::from).toList(); }

    @Transactional
    public EquipmentProcessResponse createProcess(EquipmentProcessRequest request) {
        requireAdmin(currentEmpProvider.getCurrentEmp());
        String name = request.processName().trim();
        if (equipmentProcessRepository.findByProcessName(name).isPresent()) throw BusinessException.badRequest("EQUIPMENT_PROCESS_DUPLICATED", "Process already exists");
        return EquipmentProcessResponse.from(equipmentProcessRepository.save(new EquipmentProcess(name)));
    }

    @Transactional(readOnly = true)
    public List<EquipmentReportResponse> reports() {
        return reportRepository.findAllByOrderByReportIdDesc().stream().map(EquipmentReportResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<EquipmentHistoryResponse> history(Long equipmentId) {
        equipment(equipmentId);
        return historyRepository.findByEquipmentEquipmentIdOrderByEventIdDesc(equipmentId).stream().map(EquipmentHistoryResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public EquipmentAssignmentPermissionResponse assignmentPermission() {
        Emp current = currentEmpProvider.getCurrentEmp();
        return new EquipmentAssignmentPermissionResponse(canAssignWork(current), isProductionTechManager(current));
    }

    @Transactional(readOnly = true)
    public List<EquipmentAssignmentAuthorityResponse> assignmentAuthorities() {
        requireProductionTechManager(currentEmpProvider.getCurrentEmp());
        return assignmentAuthorityRepository.findAllByOrderByCreatedAtDesc().stream().map(EquipmentAssignmentAuthorityResponse::from).toList();
    }

    @Transactional
    public EquipmentAssignmentAuthorityResponse grantAssignmentAuthority(EquipmentAssignmentAuthorityRequest request) {
        Emp manager = currentEmpProvider.getCurrentEmp();
        requireProductionTechManager(manager);
        Emp assignee = activeEmp(request.empId());
        if (assignmentAuthorityRepository.existsByEmpEmpId(assignee.getEmpId())) {
            throw BusinessException.badRequest("EQUIPMENT_ASSIGNMENT_AUTHORITY_DUPLICATED", "Assignment authority is already granted");
        }
        return EquipmentAssignmentAuthorityResponse.from(assignmentAuthorityRepository.save(new EquipmentAssignmentAuthority(assignee, manager)));
    }

    @Transactional
    public void revokeAssignmentAuthority(Long authorityId) {
        requireProductionTechManager(currentEmpProvider.getCurrentEmp());
        assignmentAuthorityRepository.delete(assignmentAuthorityRepository.findById(authorityId)
            .orElseThrow(() -> BusinessException.notFound("EQUIPMENT_ASSIGNMENT_AUTHORITY_NOT_FOUND", "Assignment authority was not found")));
    }

    @Transactional
    public EquipmentReportResponse createReport(EquipmentReportRequest request, String ipAddress, String userAgent) {
        Emp reporter = currentEmpProvider.getCurrentEmp();
        EquipmentReport report = reportRepository.save(new EquipmentReport(equipment(request.equipmentId()), reporter, request.title().trim(), request.symptom().trim(), request.requestContent().trim(), request.priority(), request.occurredOn() == null ? LocalDate.now() : request.occurredOn()));
        List<Long> approverIds = request.approverEmpIds();
        if (approverIds == null || approverIds.isEmpty()) {
            Emp manager = reporter.getManager();
            if (manager == null || !manager.isActiveUser()) {
                throw BusinessException.badRequest("EQUIPMENT_REPORT_MANAGER_REQUIRED", "Reporter must have an active department manager");
            }
            approverIds = List.of(manager.getEmpId());
        }
        ApprovalResponse approval = approvalDraftService.create(new ApprovalRequest(
            report.getTitle(), report.getRequestContent(), REPORT_TEMPLATE, json(Map.of("reportId", report.getReportId(), "equipmentNo", report.getEquipment().getEquipmentNo(), "equipmentName", report.getEquipment().getEquipmentName(), "symptom", report.getSymptom(), "occurredOn", report.getOccurredOn().toString())), report.getPriority(), List.of(), approverIds, List.of(), List.of(), List.of(), false
        ), ipAddress, userAgent);
        report.linkInitialApproval(approval.approvalId());
        event(report, reporter, "REPORT_SUBMITTED", "이상보고가 등록되어 결재를 요청했습니다.");
        return EquipmentReportResponse.from(report);
    }

    @Transactional
    public EquipmentReportResponse assign(Long reportId, EquipmentAssignmentRequest request) {
        Emp manager = currentEmpProvider.getCurrentEmp();
        requireAssignmentAuthority(manager);
        EquipmentReport report = report(reportId);
        if (!EquipmentReport.ASSIGNMENT_PENDING.equals(report.getState())) {
            throw BusinessException.badRequest("EQUIPMENT_ASSIGNMENT_NOT_READY", "Report is not ready for assignment");
        }
        Emp assignee = activeEmp(request.assigneeEmpId());
        report.assign(manager, assignee, request.plannedStartOn(), request.plannedEndOn(), request.instruction());
        event(report, manager, "WORK_ASSIGNED", "생산기술팀장이 보전 담당자에게 작업을 배분했습니다.");
        notificationService.notifyEmp(assignee.getEmpId(), "설비 이상 작업 배분", "새 설비 이상 작업이 배분되었습니다.", "EQUIPMENT_REPORT", report.getReportId());
        return EquipmentReportResponse.from(report);
    }

    @Transactional
    public EquipmentReportResponse submitCompletion(Long reportId, EquipmentCompletionRequest request, String ipAddress, String userAgent) {
        Emp assignee = currentEmpProvider.getCurrentEmp();
        EquipmentReport report = report(reportId);
        if (!EquipmentReport.IN_PROGRESS.equals(report.getState()) && !EquipmentReport.REWORK.equals(report.getState())) {
            throw BusinessException.badRequest("EQUIPMENT_COMPLETION_NOT_READY", "Report is not ready for completion");
        }
        if (report.getAssignee() == null || !report.getAssignee().getEmpId().equals(assignee.getEmpId())) {
            throw BusinessException.forbidden("EQUIPMENT_ASSIGNEE_REQUIRED", "Only the assigned maintenance employee can submit completion");
        }
        List<Long> approverIds = request.approverEmpIds();
        if (approverIds == null || approverIds.isEmpty()) {
            Emp approver = report.getAssignedBy();
            if (approver == null || !approver.isActiveUser()) throw BusinessException.badRequest("EQUIPMENT_COMPLETION_APPROVER_REQUIRED", "An active production engineering manager is required");
            approverIds = List.of(approver.getEmpId());
        }
        ApprovalResponse approval = approvalDraftService.create(new ApprovalRequest(
            report.getTitle() + " 작업완료", request.workResult(), COMPLETION_TEMPLATE, json(Map.of("reportId", report.getReportId(), "equipmentNo", report.getEquipment().getEquipmentNo(), "equipmentName", report.getEquipment().getEquipmentName(), "workResult", request.workResult(), "causeAnalysis", blank(request.causeAnalysis()), "actionTaken", request.actionTaken())), "NORMAL", List.of(), approverIds, List.of(), List.of(), List.of(), false
        ), ipAddress, userAgent);
        report.submitCompletion(request.workResult(), request.causeAnalysis(), request.actionTaken(), request.completedOn(), request.workDurationHours(), approval.approvalId());
        event(report, assignee, "COMPLETION_SUBMITTED", "작업 결과를 등록하고 완료 결재를 요청했습니다.");
        return EquipmentReportResponse.from(report);
    }

    @Transactional
    public void onApprovalResolved(ApprovalDocument document, boolean approved) {
        reportRepository.findByInitialApprovalId(document.getApprovalId()).ifPresent(report -> {
            if (approved) { report.initialApproved(); event(report, null, "INITIAL_APPROVED", "최초 결재가 완료되어 생산기술팀 배분 대기 상태입니다."); }
            else { report.initialRejected(); event(report, null, "INITIAL_REJECTED", "최초 결재가 반려되었습니다."); }
        });
        reportRepository.findByCompletionApprovalId(document.getApprovalId()).ifPresent(report -> {
            if (approved) { report.completionApproved(); event(report, null, "COMPLETED", "완료 결재가 승인되어 설비 이력으로 확정되었습니다."); }
            else { report.completionRejected(); event(report, null, "REWORK_REQUESTED", "완료 결재가 반려되어 같은 담당자에게 재작업으로 돌아갔습니다."); }
        });
    }

    @Transactional(readOnly = true)
    public boolean canWriteAttachment(Long reportId, Emp currentEmp) {
        return reportRepository.findById(reportId).map(report -> !EquipmentReport.COMPLETED.equals(report.getState())
            && (report.getReporter().getEmpId().equals(currentEmp.getEmpId()) || (report.getAssignee() != null && report.getAssignee().getEmpId().equals(currentEmp.getEmpId())))).orElse(false);
    }

    @Transactional(readOnly = true)
    public boolean canReadAttachment(Long reportId, Emp currentEmp) {
        return reportRepository.findById(reportId).map(report -> report.getReporter().getEmpId().equals(currentEmp.getEmpId())
            || (report.getAssignee() != null && report.getAssignee().getEmpId().equals(currentEmp.getEmpId()))
            || isProductionTechManager(currentEmp) || "ADMIN".equals(currentEmp.getRoleCode())).orElse(false);
    }

    private Equipment equipment(Long id) { return equipmentRepository.findById(id).orElseThrow(() -> BusinessException.notFound("EQUIPMENT_NOT_FOUND", "Equipment was not found")); }
    private EquipmentReport report(Long id) { return reportRepository.findById(id).orElseThrow(() -> BusinessException.notFound("EQUIPMENT_REPORT_NOT_FOUND", "Equipment report was not found")); }
    private Dept dept(Long id) { return id == null ? null : deptRepository.findById(id).orElseThrow(() -> BusinessException.notFound("DEPT_NOT_FOUND", "Department was not found")); }
    private EquipmentProcess process(Long id) { return id == null ? null : equipmentProcessRepository.findById(id).orElseThrow(() -> BusinessException.notFound("EQUIPMENT_PROCESS_NOT_FOUND", "Process was not found")); }
    private Dept ownerDept(EquipmentRequest request) { return "UTILITY".equals(request.equipmentType().trim()) ? null : dept(request.ownerDeptId()); }
    private void validateEquipment(EquipmentRequest request) {
        String type = request.equipmentType().trim();
        if (!"GENERAL".equals(type) && !"UTILITY".equals(type)) throw BusinessException.badRequest("EQUIPMENT_TYPE_INVALID", "Equipment type must be GENERAL or UTILITY");
        if ("GENERAL".equals(type) && request.ownerDeptId() == null) throw BusinessException.badRequest("EQUIPMENT_BUSINESS_UNIT_REQUIRED", "Business unit is required for general equipment");
        if (request.processId() == null) throw BusinessException.badRequest("EQUIPMENT_PROCESS_REQUIRED", "Process is required");
        if (request.introducedYear() != null && (request.introducedYear() < 1900 || request.introducedYear() > LocalDate.now().getYear())) throw BusinessException.badRequest("EQUIPMENT_INTRODUCED_YEAR_INVALID", "Introduced year is invalid");
        if (request.introducedPrice() != null && request.introducedPrice().signum() < 0) throw BusinessException.badRequest("EQUIPMENT_INTRODUCED_PRICE_INVALID", "Introduced price cannot be negative");
    }
    private Emp activeEmp(Long id) { return empRepository.findById(id).filter(Emp::isActiveUser).orElseThrow(() -> BusinessException.badRequest("EMP_NOT_ACTIVE", "Employee is not active")); }
    private void requireAdmin(Emp emp) { if (!"ADMIN".equals(emp.getRoleCode())) throw BusinessException.forbidden("EQUIPMENT_ADMIN_REQUIRED", "Equipment master management requires admin role"); }
    private void requireProductionTechManager(Emp emp) { if (!isProductionTechManager(emp)) throw BusinessException.forbidden("EQUIPMENT_TECH_MANAGER_REQUIRED", "Only the production engineering manager can manage assignment authorities"); }
    private void requireAssignmentAuthority(Emp emp) { if (!canAssignWork(emp)) throw BusinessException.forbidden("EQUIPMENT_ASSIGNMENT_FORBIDDEN", "Only assignment-authorized employees can assign work"); }
    private boolean canAssignWork(Emp emp) { return isProductionTechManager(emp) || (emp != null && assignmentAuthorityRepository.existsByEmpEmpId(emp.getEmpId())); }
    private boolean isProductionTechManager(Emp emp) { return emp != null && ("ADMIN".equals(emp.getRoleCode()) || ("MANAGER".equals(emp.getRoleCode()) && emp.getDept() != null && "PROD_TECH".equals(emp.getDept().getDeptCode()))); }
    private void event(EquipmentReport report, Emp actor, String type, String message) { historyRepository.save(new EquipmentHistoryEvent(report.getEquipment(), report, actor, type, message)); }
    private String json(Map<String, ?> values) { try { return objectMapper.writeValueAsString(values); } catch (JsonProcessingException ex) { throw BusinessException.badRequest("EQUIPMENT_FORM_JSON_FAILED", "Could not create approval form data"); } }
    private String blank(String value) { return value == null ? "" : value; }
}
