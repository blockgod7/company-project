package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.clearInvocations;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.ApprovalActionRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalResponse;
import com.kjh.groupware.domain.approval.dto.LeaveUsageResponse;
import com.kjh.groupware.domain.approval.dto.PurchaseRequestUpdateRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.emp.EmpSignatureService;
import com.kjh.groupware.domain.equipment.EquipmentManagementService;
import com.kjh.groupware.domain.notification.Notification;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDateTime;
import java.time.Year;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.domain.approval.dto.EquipmentProposalRequest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.PreparedStatementSetter;
import org.springframework.jdbc.core.ResultSetExtractor;
import org.springframework.test.util.ReflectionTestUtils;

class ApprovalServiceWorkflowTest {

    private final ApprovalDocumentRepository documentRepository = mock(ApprovalDocumentRepository.class);
    private final ApprovalLineRepository lineRepository = mock(ApprovalLineRepository.class);
    private final ApprovalTemplateRepository templateRepository = mock(ApprovalTemplateRepository.class);
    private final EmpRepository empRepository = mock(EmpRepository.class);
    private final CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private final NotificationService notificationService = mock(NotificationService.class);
    private final EmpSignatureService signatureService = mock(EmpSignatureService.class);
    private final ApprovalPdfService pdfService = mock(ApprovalPdfService.class);
    private ApprovalEquipmentProposalService equipmentProposalService;
    private final ApprovalEquipmentProposalRepository equipmentProposalRepository = mock(ApprovalEquipmentProposalRepository.class);
    private final Map<Long, ApprovalEquipmentProposal> equipmentProposals = new HashMap<>();
    private final EquipmentManagementService equipmentManagementService = mock(EquipmentManagementService.class);
    private final ApprovalDelegationService delegationService = mock(ApprovalDelegationService.class);
    private final ApprovalReminderService reminderService = mock(ApprovalReminderService.class);
    private final AnnualLeaveService annualLeaveService = mock(AnnualLeaveService.class);
    private final ApprovalHolidayRepository holidayRepository = mock(ApprovalHolidayRepository.class);
    private final ApprovalLeaveExclusionRepository exclusionRepository = mock(ApprovalLeaveExclusionRepository.class);
    private final ApprovalLeaveLifecycleCancellationRepository lifecycleCancellationRepository = mock(ApprovalLeaveLifecycleCancellationRepository.class);
    private final EmployeePermissionService employeePermissionService = mock(EmployeePermissionService.class);
    private final CompTimeLedgerService compTimeLedgerService = mock(CompTimeLedgerService.class);
    private final com.kjh.groupware.domain.work.WorkRequestService workRequestService = mock(com.kjh.groupware.domain.work.WorkRequestService.class);
    private final TrainingWorkflowService trainingWorkflowService = new TrainingWorkflowService(documentRepository, empRepository, currentEmpProvider, new ObjectMapper());
    private final ApprovalPermissionService permissionService = new ApprovalPermissionService(delegationService, trainingWorkflowService, employeePermissionService);
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final AtomicReference<Emp> currentEmp = new AtomicReference<>();
    private final AtomicLong documentIds = new AtomicLong(100);
    private final AtomicLong lineIds = new AtomicLong(1000);
    private final AtomicInteger documentSequence = new AtomicInteger(0);
    private final Map<Long, Emp> emps = new HashMap<>();
    private final Map<Long, ApprovalDocument> documents = new HashMap<>();
    private final List<ApprovalLine> lines = new ArrayList<>();

    private ApprovalService service;
    private ApprovalDraftService draftService;
    private ApprovalWorkflowService workflowService;
    private ApprovalLeaveUsageService leaveUsageService;

    @BeforeEach
    void setUp() {
        for (long id = 1; id <= 9; id++) {
            Emp emp = newEmp();
            ReflectionTestUtils.setField(emp, "empId", id);
            ReflectionTestUtils.setField(emp, "empNo", "E" + id);
            ReflectionTestUtils.setField(emp, "empName", "User" + id);
            ReflectionTestUtils.setField(emp, "roleCode", "USER");
            ReflectionTestUtils.setField(emp, "positionName", "Staff");
            ReflectionTestUtils.setField(emp, "status", "ACTIVE");
            ReflectionTestUtils.setField(emp, "accountStatus", "ACTIVE");
            ReflectionTestUtils.setField(emp, "useYn", "Y");
            emps.put(id, emp);
        }

        ApprovalTemplate template = ApprovalTemplate.builder()
            .templateCode("PURCHASE")
            .templateName("Purchase")
            .version(1)
            .fieldsJson("{}")
            .activeYn("Y")
            .build();
        ApprovalTemplate trainingReportTemplate = ApprovalTemplate.builder()
            .templateCode("TRAINING_REPORT")
            .templateName("Training report")
            .version(1)
            .fieldsJson("{}")
            .activeYn("Y")
            .build();

        when(currentEmpProvider.getCurrentEmp()).thenAnswer(invocation -> currentEmp.get());
        when(templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(eq("PURCHASE"), eq("Y"))).thenReturn(Optional.of(template));
        when(templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(eq("TRAINING_REPORT"), eq("Y"))).thenReturn(Optional.of(trainingReportTemplate));
        when(empRepository.findByIdForUpdate(any())).thenAnswer(i -> Optional.ofNullable(emps.get(i.getArgument(0))));
        when(documentRepository.findByRequesterAndTemplateCodeIn(any(), any())).thenAnswer(i -> {
            Emp owner = i.getArgument(0); Collection<String> codes = i.getArgument(1);
            return documents.values().stream().filter(d -> d.getRequester().getEmpId().equals(owner.getEmpId()) && codes.contains(d.getTemplateCode())).toList();
        });
        for (String code : List.of("TRAINING_REQUEST", "TRAINING_CHANGE")) {
            when(templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(code, "Y")).thenReturn(Optional.of(
                ApprovalTemplate.builder().templateCode(code).templateName(code).version(2).fieldsJson("[]").activeYn("Y").build()));
        }
        when(empRepository.findById(any())).thenAnswer(invocation -> Optional.ofNullable(emps.get(invocation.getArgument(0))));
        when(documentRepository.save(any(ApprovalDocument.class))).thenAnswer(invocation -> {
            ApprovalDocument document = invocation.getArgument(0);
            if (document.getApprovalId() == null) {
                ReflectionTestUtils.setField(document, "approvalId", documentIds.incrementAndGet());
            }
            documents.put(document.getApprovalId(), document);
            return document;
        });
        when(documentRepository.findById(any())).thenAnswer(invocation -> Optional.ofNullable(documents.get(invocation.getArgument(0))));
        when(documentRepository.findByIdForUpdate(any())).thenAnswer(invocation -> Optional.ofNullable(documents.get(invocation.getArgument(0))));
        when(documentRepository.findMaxDocumentSequence(anyString())).thenAnswer(invocation -> documentSequence.getAndIncrement());
        when(jdbcTemplate.query(anyString(), any(PreparedStatementSetter.class), any(ResultSetExtractor.class))).thenReturn(null);
        when(lineRepository.save(any(ApprovalLine.class))).thenAnswer(invocation -> {
            ApprovalLine line = invocation.getArgument(0);
            if (line.getLineId() == null) {
                ReflectionTestUtils.setField(line, "lineId", lineIds.incrementAndGet());
            }
            lines.removeIf(saved -> saved.getLineId().equals(line.getLineId()));
            lines.add(line);
            return line;
        });
        when(lineRepository.findByDocumentOrderByLineOrderAsc(any())).thenAnswer(invocation -> {
            ApprovalDocument document = invocation.getArgument(0);
            return lines.stream()
                .filter(line -> line.getDocument() == document)
                .sorted(Comparator.comparing(ApprovalLine::getLineOrder))
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        });
        when(lineRepository.findByIdForUpdate(any())).thenAnswer(invocation -> lines.stream()
            .filter(line -> line.getLineId().equals(invocation.getArgument(0)))
            .findFirst());
        when(lineRepository.findOpenReceiverInboxLines(any(), any())).thenAnswer(invocation -> {
            Emp assignedEmp = invocation.getArgument(0);
            Pageable pageable = invocation.getArgument(1);
            List<ApprovalLine> result = lines.stream()
                .filter(line -> line.isReceiver())
                .filter(line -> line.getAssignedEmp() != null && line.getAssignedEmp().getEmpId().equals(assignedEmp.getEmpId()))
                .filter(line -> ApprovalLine.STATUS_RECEIVED.equals(line.getStatus()) || ApprovalLine.STATUS_READ.equals(line.getStatus()))
                .filter(line -> lines.stream().noneMatch(decisionLine -> decisionLine.getDocument() == line.getDocument()
                    && decisionLine.isDecisionLine()
                    && decisionLine.getLineOrder() > line.getLineOrder()))
                .sorted(Comparator.comparing(ApprovalLine::getLineId).reversed())
                .toList();
            return new PageImpl<>(result, pageable, result.size());
        });
        when(lineRepository.findByAssignedEmpInAndLineTypeAndStatusOrderByLineIdDesc(any(), anyString(), anyString(), any())).thenAnswer(invocation -> {
            Collection<Emp> assignedEmps = invocation.getArgument(0);
            String lineType = invocation.getArgument(1);
            String lineStatus = invocation.getArgument(2);
            Pageable pageable = invocation.getArgument(3);
            Set<Long> assignedIds = assignedEmps.stream().map(Emp::getEmpId).collect(java.util.stream.Collectors.toSet());
            List<ApprovalLine> result = lines.stream()
                .filter(line -> line.getAssignedEmp() != null && assignedIds.contains(line.getAssignedEmp().getEmpId()))
                .filter(line -> lineType.equals(line.getLineType()))
                .filter(line -> lineStatus.equals(line.getStatus()))
                .sorted(Comparator.comparing(ApprovalLine::getLineId).reversed())
                .toList();
            return new PageImpl<>(result, pageable, result.size());
        });
        when(lineRepository.countByAssignedEmpInAndLineTypeInAndStatus(any(), any(), anyString())).thenAnswer(invocation -> {
            Collection<Emp> assignedEmps = invocation.getArgument(0);
            Collection<String> lineTypes = invocation.getArgument(1);
            String lineStatus = invocation.getArgument(2);
            Set<Long> assignedIds = assignedEmps.stream().map(Emp::getEmpId).collect(java.util.stream.Collectors.toSet());
            return lines.stream()
                .filter(line -> "N".equals(line.getDocument().getDeletedYn()))
                .filter(line -> line.getAssignedEmp() != null && assignedIds.contains(line.getAssignedEmp().getEmpId()))
                .filter(line -> lineTypes.contains(line.getLineType()))
                .filter(line -> lineStatus.equals(line.getStatus()))
                .count();
        });
        when(lineRepository.countOverdueByAssignedEmpIn(any(), any(), anyString(), any())).thenAnswer(invocation -> {
            Collection<Emp> assignedEmps = invocation.getArgument(0);
            Collection<String> lineTypes = invocation.getArgument(1);
            String lineStatus = invocation.getArgument(2);
            LocalDateTime now = invocation.getArgument(3);
            Set<Long> assignedIds = assignedEmps.stream().map(Emp::getEmpId).collect(java.util.stream.Collectors.toSet());
            return lines.stream()
                .filter(line -> "N".equals(line.getDocument().getDeletedYn()))
                .filter(line -> line.getAssignedEmp() != null && assignedIds.contains(line.getAssignedEmp().getEmpId()))
                .filter(line -> lineTypes.contains(line.getLineType()))
                .filter(line -> lineStatus.equals(line.getStatus()))
                .filter(line -> line.getDueAt() != null && line.getDueAt().isBefore(now))
                .count();
        });
        org.mockito.Mockito.doAnswer(invocation -> {
            ApprovalDocument document = invocation.getArgument(0);
            lines.removeIf(line -> line.getDocument() == document);
            return null;
        }).when(lineRepository).deleteByDocument(any());
        when(documentRepository.countByRequesterAndDeletedYnAndStatus(any(), anyString(), anyString())).thenAnswer(invocation -> {
            Emp requester = invocation.getArgument(0);
            String deletedYn = invocation.getArgument(1);
            String documentStatus = invocation.getArgument(2);
            return documents.values().stream()
                .filter(document -> requester.getEmpId().equals(document.getRequester().getEmpId()))
                .filter(document -> deletedYn.equals(document.getDeletedYn()))
                .filter(document -> documentStatus.equals(document.getStatus()))
                .count();
        });
        when(documentRepository.countByRequesterAndDeletedYnAndStatusInAndCompletedAtAfter(any(), anyString(), any(), any())).thenAnswer(invocation -> {
            Emp requester = invocation.getArgument(0);
            String deletedYn = invocation.getArgument(1);
            Collection<String> statuses = invocation.getArgument(2);
            LocalDateTime completedAfter = invocation.getArgument(3);
            return documents.values().stream()
                .filter(document -> requester.getEmpId().equals(document.getRequester().getEmpId()))
                .filter(document -> deletedYn.equals(document.getDeletedYn()))
                .filter(document -> statuses.contains(document.getStatus()))
                .filter(document -> document.getCompletedAt() != null && document.getCompletedAt().isAfter(completedAfter))
                .count();
        });
        when(documentRepository.findByRequesterAndDeletedYnAndTemplateCodeAndStatus(any(), anyString(), anyString(), anyString())).thenAnswer(invocation -> {
            Emp requester = invocation.getArgument(0);
            String deletedYn = invocation.getArgument(1);
            String templateCode = invocation.getArgument(2);
            String documentStatus = invocation.getArgument(3);
            return documents.values().stream()
                .filter(document -> requester.getEmpId().equals(document.getRequester().getEmpId()))
                .filter(document -> deletedYn.equals(document.getDeletedYn()))
                .filter(document -> templateCode.equals(document.getTemplateCode()))
                .filter(document -> documentStatus.equals(document.getStatus()))
                .sorted(Comparator.comparing(ApprovalDocument::getApprovalId))
                .toList();
        });
        when(signatureService.snapshotJson(any())).thenReturn("{}");
        when(signatureService.activeSignatureFile(any())).thenReturn(null);
        when(reminderService.decisionDueAt()).thenReturn(LocalDateTime.of(2026, 6, 23, 9, 0));
        when(notificationService.notifyEmp(any(), anyString(), anyString(), anyString(), any())).thenReturn(mock(Notification.class));
        when(annualLeaveService.totalDays(any(), anyInt())).thenReturn(java.math.BigDecimal.valueOf(16));
        ApprovalLinePolicyService linePolicyService = new ApprovalLinePolicyService(
            lineRepository,
            empRepository,
            delegationService,
            reminderService
        );
        leaveUsageService = new ApprovalLeaveUsageService(
            documentRepository,
            currentEmpProvider,
            new ObjectMapper(),
            annualLeaveService,
            holidayRepository,
            exclusionRepository,
            lifecycleCancellationRepository,
            mock(LeavePolicyService.class),
            mock(LeavePolicyOverrideService.class),
            mock(BereavementPolicyRepository.class),
            mock(com.kjh.groupware.domain.file.AttachFileRepository.class)
        );
        equipmentProposalService = new ApprovalEquipmentProposalService(equipmentProposalRepository, documentRepository, lineRepository, empRepository, currentEmpProvider, reminderService, notificationService, new ObjectMapper());
        when(equipmentProposalRepository.findByApprovalApprovalId(any())).thenAnswer(i -> Optional.ofNullable(equipmentProposals.get(i.getArgument(0))));
        when(equipmentProposalRepository.findByApprovalIdForUpdate(any())).thenAnswer(i -> Optional.ofNullable(equipmentProposals.get(i.getArgument(0))));
        when(equipmentProposalRepository.save(any())).thenAnswer(i -> {
            ApprovalEquipmentProposal proposal = i.getArgument(0);
            ReflectionTestUtils.setField(proposal, "approvalId", proposal.getApproval().getApprovalId());
            equipmentProposals.put(proposal.getApprovalId(), proposal);
            return proposal;
        });
        when(empRepository.findActiveByDeptCodeOrderForRouting(anyString())).thenAnswer(i -> emps.values().stream()
            .filter(emp -> emp.getDept() != null && emp.getDept().getDeptCode().equals(i.getArgument(0))).toList());
        draftService = new ApprovalDraftService(
            documentRepository,
            lineRepository,
            templateRepository,
            currentEmpProvider,
            auditLogService,
            notificationService,
            permissionService,
            linePolicyService,
            equipmentProposalService,
            leaveUsageService,
            compTimeLedgerService,
            workRequestService,
            trainingWorkflowService,
            delegationService,
            jdbcTemplate,
            new ObjectMapper()
        );
        workflowService = new ApprovalWorkflowService(
            documentRepository,
            lineRepository,
            templateRepository,
            currentEmpProvider,
            auditLogService,
            notificationService,
            empRepository,
            signatureService,
            pdfService,
            permissionService,
            reminderService,
            linePolicyService,
            equipmentProposalService,
            leaveUsageService,
            compTimeLedgerService,
            equipmentManagementService,
            new ObjectMapper(),
            employeePermissionService,
            workRequestService,
            trainingWorkflowService
        );

        service = new ApprovalService(
            documentRepository,
            lineRepository,
            empRepository,
            currentEmpProvider,
            auditLogService,
            permissionService,
            delegationService,
            new ObjectMapper()
        );
    }

    @ParameterizedTest
    @ValueSource(strings = {"EQUIPMENT_PROPOSAL", "MOLD_FIXTURE_PROPOSAL"})
    void productionEngineeringSelfRequestGoesToPurchaseOnlyAfterAllDecisions(String code) throws Exception {
        configureEquipment(code, true);
        currentEmp.set(emps.get(1L));
        ApprovalRequest request = equipmentRequest(code, "STANDARD", false);
        Long id = draftService.create(request, "test", "test").approvalId();
        ApprovalDocument document = createdDocument(id);
        ApprovalEquipmentProposal proposal = equipmentProposals.get(id);
        assertThat(proposal.isPeSelfRequest()).isTrue();
        assertThat(proposal.getPeOpinion()).isEqualTo("기술 검토");
        assertThat(proposal.getDesignOpinion()).isEqualTo("설계 검토");
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isReceiver).extracting(line -> line.getAssignedEmp().getEmpId()).containsExactly(6L);
        assertThat(orderedLines(document)).filteredOn(line -> ApprovalLine.STATUS_PENDING.equals(line.getStatus())).extracting(line -> line.getAssignedEmp().getEmpId()).containsExactly(2L);
        decideEquipment(id, 2L);
        decideEquipment(id, 4L);
        assertThat(proposal.getWorkflowStage()).isEqualTo("USER_APPROVAL");
        assertThat(proposal.getPurchaseAssignee()).isNull();
        // Changing the employee's department must not change an already submitted route.
        ReflectionTestUtils.setField(emps.get(1L), "dept", department("OTHER"));
        decideEquipment(id, 5L);
        assertThat(proposal.getWorkflowStage()).isEqualTo("PURCHASE_INPUT");
        assertThat(proposal.getPurchaseAssignee().getEmpId()).isEqualTo(6L);
        assertThat(orderedLines(document)).filteredOn(line -> ApprovalLine.STATUS_PENDING.equals(line.getStatus())).extracting(line -> line.getAssignedEmp().getEmpId()).containsExactly(6L);
        assertThat(orderedLines(document)).noneMatch(line -> "PE_INPUT_COMPLETED".equals(line.getComment()));
        currentEmp.set(emps.get(6L));
        assertThatThrownBy(() -> workflowService.approve(id, new ApprovalActionRequest("premature"), "test", "test")).isInstanceOf(BusinessException.class);
        EquipmentProposalRequest purchase = new ObjectMapper().convertValue(Map.of("approverEmpIds", List.of(8L), "purchaseOpinion", "구매 검토"), EquipmentProposalRequest.class);
        equipmentProposalService.submitPurchase(id, purchase);
        decideEquipment(id, 8L);
        assertThat(proposal.getWorkflowStage()).isEqualTo("COMPLETED");
        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_APPROVED);
        verify(pdfService).generateForFinalApproval(document);
    }

    @ParameterizedTest
    @ValueSource(strings = {"EQUIPMENT_PROPOSAL", "MOLD_FIXTURE_PROPOSAL"})
    void externalRequestCannotForgeSelfRoutingAndStillVisitsProductionEngineering(String code) {
        configureEquipment(code, false);
        currentEmp.set(emps.get(1L));
        Long id = draftService.create(equipmentRequest(code, "PE_SELF", false), "test", "test").approvalId();
        assertThat(equipmentProposals.get(id).isPeSelfRequest()).isFalse();
        decideEquipment(id, 2L);
        decideEquipment(id, 4L);
        decideEquipment(id, 5L);
        assertThat(equipmentProposals.get(id).getWorkflowStage()).isEqualTo("PE_INPUT");
        assertThat(equipmentProposals.get(id).getPurchaseAssignee()).isNull();
    }

    @Test
    void legacyUnmarkedPeRequestKeepsItsExistingRoute() {
        configureEquipment("EQUIPMENT_PROPOSAL", true);
        currentEmp.set(emps.get(1L));
        Long id = draftService.create(equipmentRequest("EQUIPMENT_PROPOSAL", "STANDARD", false), "test", "test").approvalId();
        createdDocument(id).updateFormDataJson("{\"fields\":{}}", "legacy");
        decideEquipment(id, 2L);
        decideEquipment(id, 4L);
        decideEquipment(id, 5L);
        assertThat(equipmentProposals.get(id).getWorkflowStage()).isEqualTo("PE_INPUT");
    }

    @Test
    void selfRequestDraftUpdatesPeFieldsAndRequiresAnotherApprover() {
        configureEquipment("MOLD_FIXTURE_PROPOSAL", true);
        currentEmp.set(emps.get(1L));
        ApprovalRequest request = equipmentRequest("MOLD_FIXTURE_PROPOSAL", "STANDARD", true);
        Long id = draftService.create(request, "test", "test").approvalId();
        draftService.updateDraft(id, request, "test", "test");
        assertThat(equipmentProposals.get(id).getDesignOpinion()).isEqualTo("설계 검토");
        ApprovalRequest selfApproval = new ApprovalRequest(request.title(), request.content(), request.templateCode(), request.formDataJson(), "NORMAL", List.of(), List.of(1L), List.of(6L), List.of(), List.of(), false);
        assertThatThrownBy(() -> draftService.submit(id, selfApproval, "test", "test")).isInstanceOf(BusinessException.class);
        draftService.submit(id, equipmentRequest("MOLD_FIXTURE_PROPOSAL", "STANDARD", false), "test", "test");
        assertThat(equipmentProposals.get(id).isPeSelfRequest()).isTrue();
    }

    private void configureEquipment(String code, boolean self) {
        when(templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(code, "Y")).thenReturn(Optional.of(ApprovalTemplate.builder().templateCode(code).templateName(code).version(1).fieldsJson("[]").activeYn("Y").build()));
        ReflectionTestUtils.setField(emps.get(1L), "dept", department(self ? "PROD_TECH" : "OTHER"));
        ReflectionTestUtils.setField(emps.get(3L), "dept", department("PROD_TECH"));
        ReflectionTestUtils.setField(emps.get(6L), "dept", department("PURCHASE"));
    }

    private Dept department(String code) {
        Dept dept = mock(Dept.class);
        when(dept.getDeptCode()).thenReturn(code);
        when(dept.getDeptName()).thenReturn(code);
        return dept;
    }

    private ApprovalRequest equipmentRequest(String code, String mode, boolean draft) {
        return new ApprovalRequest("품의", "content", code, "{\"fields\":{\"equipmentRequestMode\":\"" + mode + "\",\"requestDeptName\":\"생산기술\",\"peOpinion\":\"기술 검토\",\"designOpinion\":\"설계 검토\",\"peEconomicReview\":\"경제성 검토\"}}", "NORMAL", List.of(2L), List.of(4L, 5L), List.of(3L), List.of(), List.of(), draft);
    }

    private void decideEquipment(Long id, Long empId) {
        currentEmp.set(emps.get(empId));
        workflowService.approve(id, new ApprovalActionRequest("검토 완료"), "test", "test");
    }

    @Test
    void referencesOpenOnSubmissionAndLoseAccessOnWithdrawalWithoutOpeningReceivers() {
        currentEmp.set(emps.get(1L));
        ApprovalRequest draft = request(List.of(), List.of(4L), List.of(6L), List.of(7L), List.of(8L), true);
        Long id = draftService.create(draft, "test", "test").approvalId();
        ApprovalDocument document = createdDocument(id);
        assertThat(permissionService.permissions(emps.get(7L), document, orderedLines(document)).canView()).isFalse();
        verify(notificationService, times(0)).notifyEmp(eq(7L), anyString(), anyString(), eq("APPROVAL"), eq(id));
        ApprovalRequest submit = request(List.of(), List.of(4L), List.of(6L), List.of(7L), List.of(8L), false);
        draftService.submit(id, submit, "test", "test");
        assertThat(permissionService.permissions(emps.get(7L), document, orderedLines(document)).canView()).isTrue();
        assertThat(permissionService.permissions(emps.get(6L), document, orderedLines(document)).canView()).isFalse();
        assertThat(permissionService.permissions(emps.get(8L), document, orderedLines(document)).canView()).isFalse();
        verify(notificationService).notifyEmp(eq(7L), eq("참조 문서 도착"), anyString(), eq("APPROVAL"), eq(id));
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isReference)
            .extracting(ApprovalLine::getReadAt).containsOnlyNulls();
        workflowService.withdraw(id, new ApprovalActionRequest("수정"), "test", "test");
        currentEmp.set(emps.get(7L));
        assertThatThrownBy(() -> service.findOne(id, "test", "test")).isInstanceOf(BusinessException.class);
        currentEmp.set(emps.get(1L));
        draftService.submit(id, submit, "test", "test");
        verify(notificationService, times(2)).notifyEmp(eq(7L), eq("참조 문서 도착"), anyString(), eq("APPROVAL"), eq(id));
        currentEmp.set(emps.get(4L));
        workflowService.reject(id, new ApprovalActionRequest("반려"), "test", "test");
        currentEmp.set(emps.get(7L));
        assertThat(service.findOne(id, "test", "test").permissions().canView()).isTrue();
    }

    @Test
    void agreementApprovalReceiptAndShareFlow() {
        currentEmp.set(emps.get(1L));
        Long approvalId = draftService.create(request(
            List.of(2L, 3L),
            List.of(4L, 5L),
            List.of(6L),
            List.of(7L),
            List.of(8L),
            false
        ), "127.0.0.1", "test").approvalId();
        ApprovalDocument document = createdDocument(approvalId);
        List<ApprovalLine> documentLines = orderedLines(document);

        assertThat(permissionService.permissions(emps.get(7L), document, documentLines).canView()).isTrue();
        assertThat(permissionService.permissions(emps.get(7L), document, documentLines).canPrintPdf()).isFalse();
        assertThat(permissionService.permissions(emps.get(6L), document, documentLines).canView()).isFalse();
        assertThat(permissionService.permissions(emps.get(8L), document, documentLines).canView()).isFalse();
        verify(notificationService).notifyEmp(eq(7L), eq("참조 문서 도착"), anyString(), eq("APPROVAL"), eq(approvalId));
        assertThat(document.getDocumentNo()).startsWith("PUR-");
        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_IN_PROGRESS);
        assertThat(document.getCurrentStage()).isEqualTo(ApprovalDocument.STAGE_AGREEMENT_PROGRESS);
        assertThat(documentLines).filteredOn(ApprovalLine::isAgreement).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_PENDING, ApprovalLine.STATUS_PENDING);
        assertThat(documentLines).filteredOn(ApprovalLine::isAgreement).extracting(ApprovalLine::getDueAt)
            .containsExactly(LocalDateTime.of(2026, 6, 23, 9, 0), LocalDateTime.of(2026, 6, 23, 9, 0));
        assertThat(documentLines).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_WAITING, ApprovalLine.STATUS_WAITING);
        assertThat(documentLines).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getDueAt)
            .containsExactly((LocalDateTime) null, null);

        currentEmp.set(emps.get(2L));
        workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("agree"), "127.0.0.1", "test");
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_WAITING, ApprovalLine.STATUS_WAITING);

        currentEmp.set(emps.get(3L));
        workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("agree"), "127.0.0.1", "test");
        assertThat(document.getCurrentStage()).isEqualTo(ApprovalDocument.STAGE_APPROVAL_PROGRESS);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_PENDING, ApprovalLine.STATUS_WAITING);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getDueAt)
            .containsExactly(LocalDateTime.of(2026, 6, 23, 9, 0), null);

        currentEmp.set(emps.get(4L));
        workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("approve"), "127.0.0.1", "test");
        assertThatThrownBy(() -> workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("again"), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_APPROVED, ApprovalLine.STATUS_PENDING);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getDueAt)
            .containsExactly(LocalDateTime.of(2026, 6, 23, 9, 0), LocalDateTime.of(2026, 6, 23, 9, 0));

        currentEmp.set(emps.get(5L));
        workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("approve"), "127.0.0.1", "test");
        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_IN_PROGRESS);
        assertThat(document.getCurrentStage()).isEqualTo(ApprovalDocument.STAGE_RECEIVER_PROGRESS);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isReceiver).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_RECEIVED);

        currentEmp.set(emps.get(1L));
        assertThat(service.findOne(document.getApprovalId(), "127.0.0.1", "test").permissions().canView()).isTrue();
        currentEmp.set(emps.get(6L));
        assertThat(service.findOne(document.getApprovalId(), "127.0.0.1", "test").permissions().canReceive()).isTrue();
        currentEmp.set(emps.get(7L));
        assertThat(service.findOne(document.getApprovalId(), "127.0.0.1", "test").permissions().canApprove()).isFalse();
        currentEmp.set(emps.get(8L));
        assertThat(service.findOne(document.getApprovalId(), "127.0.0.1", "test").permissions().canReject()).isFalse();
        currentEmp.set(emps.get(9L));
        assertThatThrownBy(() -> service.findOne(document.getApprovalId(), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        verify(auditLogService, atLeastOnce()).record(
            eq(9L),
            eq(AuditActionType.ACCESS_DENIED),
            eq("approval_document"),
            eq(document.getApprovalId()),
            any(),
            any(),
            eq("127.0.0.1"),
            eq("test"),
            eq("문서 조회 권한 없음"),
            eq(false)
        );

        currentEmp.set(emps.get(6L));
        workflowService.receive(document.getApprovalId(), "127.0.0.1", "test");
        assertThatThrownBy(() -> workflowService.receive(document.getApprovalId(), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        workflowService.submitPurchaseApproval(
            document.getApprovalId(),
            new PurchaseRequestUpdateRequest(null, List.of(), List.of(7L)),
            "127.0.0.1",
            "test"
        );
        assertThat(document.getCurrentStage()).isEqualTo(ApprovalDocument.STAGE_APPROVAL_PROGRESS);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_APPROVED, ApprovalLine.STATUS_APPROVED, ApprovalLine.STATUS_PENDING);

        currentEmp.set(emps.get(6L));
        assertThat(service.findOne(document.getApprovalId(), "127.0.0.1", "test").permissions().canView()).isTrue();
        currentEmp.set(emps.get(7L));
        assertThat(service.findOne(document.getApprovalId(), "127.0.0.1", "test").permissions().canApprove()).isTrue();
        workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("purchase approve"), "127.0.0.1", "test");
        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_APPROVED);
        assertThat(document.getCurrentStage()).isEqualTo(ApprovalDocument.STAGE_COMPLETED);
        verify(pdfService).generateForFinalApproval(document);
        verify(notificationService, times(1)).notifyEmp(eq(7L), eq("참조 문서 도착"), anyString(), eq("APPROVAL"), eq(approvalId));
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isReceiver).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_READ);
        assertThatThrownBy(() -> workflowService.submitPurchaseApproval(
            document.getApprovalId(),
            new PurchaseRequestUpdateRequest(null, List.of(), List.of(7L)),
            "127.0.0.1",
            "test"
        ))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void trainingReportApprovalHandoffAndReceiverDepartmentApprovalFlow() {
        currentEmp.set(emps.get(1L));
        when(templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc("TRAINING_REPORT", "Y")).thenReturn(Optional.of(
            ApprovalTemplate.builder().templateCode("TRAINING_REPORT").templateName("New linked report").version(2)
                .fieldsJson("[{\"name\":\"sourceTrainingApprovalId\",\"required\":true}]").activeYn("Y").build()));
        ApprovalDocument document = documentRepository.save(ApprovalDocument.builder()
            .title("Legacy education report").templateCode("TRAINING_REPORT").templateVersion(1)
            .templateSnapshotJson("{\"templateName\":\"Legacy report\",\"fieldsJson\":\"[]\"}")
            .formDataJson("{\"content\":\"legacy report\"}").requester(emps.get(1L)).build());
        document.saveAsDraft();
        draftService.submit(document.getApprovalId(), requestForTemplate("TRAINING_REPORT", List.of(), List.of(4L), List.of(6L), List.of(), List.of(), false), "127.0.0.1", "test");

        currentEmp.set(emps.get(4L));
        workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("approved"), "127.0.0.1", "test");

        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_IN_PROGRESS);
        assertThat(document.getCurrentStage()).isEqualTo(ApprovalDocument.STAGE_RECEIVER_PROGRESS);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isReceiver).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_RECEIVED);
        verify(pdfService, times(0)).generateForFinalApproval(document);

        currentEmp.set(emps.get(6L));
        workflowService.receive(document.getApprovalId(), "127.0.0.1", "test");
        assertThat(service.findPage("received", 0, 10, null, null, null, null, null, null, null).content())
            .extracting("approvalId")
            .contains(document.getApprovalId());
        workflowService.submitPurchaseApproval(
            document.getApprovalId(),
            new PurchaseRequestUpdateRequest(null, List.of(), List.of(7L)),
            "127.0.0.1",
            "test"
        );

        assertThat(document.getCurrentStage()).isEqualTo(ApprovalDocument.STAGE_APPROVAL_PROGRESS);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_APPROVED, ApprovalLine.STATUS_PENDING);
        assertThat(service.findPage("received", 0, 10, null, null, null, null, null, null, null).content())
            .extracting("approvalId")
            .doesNotContain(document.getApprovalId());

        currentEmp.set(emps.get(7L));
        assertThat(service.findPage("pending", 0, 10, null, null, null, null, null, null, null).content())
            .extracting("approvalId")
            .contains(document.getApprovalId());
        workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("receiver department approved"), "127.0.0.1", "test");

        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_APPROVED);
        assertThat(document.getCurrentStage()).isEqualTo(ApprovalDocument.STAGE_COMPLETED);
        verify(pdfService, times(1)).generateForFinalApproval(document);
    }

    @Test
    void noAgreementStartsFirstApproverAndRejectSkipsFutureLines() {
        currentEmp.set(emps.get(1L));
        ApprovalDocument document = createdDocument(draftService.create(request(
            List.of(),
            List.of(4L, 5L),
            List.of(6L),
            List.of(7L),
            List.of(8L),
            false
        ), "127.0.0.1", "test").approvalId());

        assertThat(document.getCurrentStage()).isEqualTo(ApprovalDocument.STAGE_APPROVAL_PROGRESS);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_PENDING, ApprovalLine.STATUS_WAITING);

        currentEmp.set(emps.get(4L));
        assertThatThrownBy(() -> workflowService.reject(document.getApprovalId(), new ApprovalActionRequest(" "), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        workflowService.reject(document.getApprovalId(), new ApprovalActionRequest("not acceptable"), "127.0.0.1", "test");

        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_REJECTED);
        assertThat(orderedLines(document)).extracting(ApprovalLine::getStatus)
            .containsExactly(
                ApprovalLine.STATUS_REJECTED,
                ApprovalLine.STATUS_SKIPPED,
                ApprovalLine.STATUS_SKIPPED,
                ApprovalLine.STATUS_READ,
                ApprovalLine.STATUS_SKIPPED
            );
        assertThatThrownBy(() -> workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("late"), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void boxesAndUnifiedActionApiValidateInputs() {
        currentEmp.set(emps.get(1L));
        assertThat(service.boxes()).extracting("code").doesNotContain("all");
        assertThatThrownBy(() -> service.findPage("unknown", 0, 10, null, null, null, null, null, null, null))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("문서함");

        ApprovalDocument document = createdDocument(draftService.create(request(
            List.of(),
            List.of(4L),
            List.of(),
            List.of(),
            List.of(),
            false
        ), "127.0.0.1", "test").approvalId());

        currentEmp.set(emps.get(4L));
        ApprovalResponse approved = workflowService.act(document.getApprovalId(), "approve", new ApprovalActionRequest("ok"), "127.0.0.1", "test");
        assertThat(approved.status()).isEqualTo(ApprovalDocument.STATUS_APPROVED);
        assertThatThrownBy(() -> workflowService.act(document.getApprovalId(), "unknown", null, "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void delegatedApproverCanApprovePendingLineAndIsRecordedAsActor() {
        currentEmp.set(emps.get(1L));
        ApprovalDocument document = createdDocument(draftService.create(request(
            List.of(),
            List.of(4L),
            List.of(),
            List.of(),
            List.of(),
            false
        ), "127.0.0.1", "test").approvalId());
        ApprovalLine approvalLine = orderedLines(document).stream()
            .filter(ApprovalLine::isApproval)
            .findFirst()
            .orElseThrow();
        when(delegationService.canActFor(emps.get(9L), emps.get(4L))).thenReturn(true);

        currentEmp.set(emps.get(9L));
        workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("delegated"), "127.0.0.1", "test");

        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_APPROVED);
        assertThat(approvalLine.getAssignedEmp().getEmpId()).isEqualTo(4L);
        assertThat(approvalLine.getActedEmp().getEmpId()).isEqualTo(9L);
        assertThat(service.findOne(document.getApprovalId(), "127.0.0.1", "test").permissions().canView()).isTrue();
    }

    @Test
    void withdrawResubmitRedraftAndSelectionValidation() {
        currentEmp.set(emps.get(1L));
        ApprovalDocument document = createdDocument(draftService.create(request(
            List.of(),
            List.of(4L, 5L),
            List.of(),
            List.of(),
            List.of(),
            false
        ), "127.0.0.1", "test").approvalId());
        String originalDocumentNo = document.getDocumentNo();

        workflowService.withdraw(document.getApprovalId(), new ApprovalActionRequest("fix"), "127.0.0.1", "test");
        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_WITHDRAWN);
        draftService.submit(document.getApprovalId(), request(List.of(), List.of(4L, 5L), List.of(), List.of(), List.of(), false), "127.0.0.1", "test");
        assertThat(document.getDocumentNo()).isEqualTo(originalDocumentNo);
        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_IN_PROGRESS);

        currentEmp.set(emps.get(4L));
        workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("ok"), "127.0.0.1", "test");
        currentEmp.set(emps.get(1L));
        assertThatThrownBy(() -> workflowService.withdraw(document.getApprovalId(), new ApprovalActionRequest("too late"), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);

        currentEmp.set(emps.get(5L));
        workflowService.reject(document.getApprovalId(), new ApprovalActionRequest("reject"), "127.0.0.1", "test");
        currentEmp.set(emps.get(1L));
        ApprovalDocument copied = createdDocument(workflowService.redraft(document.getApprovalId(), "127.0.0.1", "test").approvalId());
        assertThat(copied.getStatus()).isEqualTo(ApprovalDocument.STATUS_DRAFT);
        assertThat(copied.getDocumentNo()).isNull();
        draftService.submit(copied.getApprovalId(), request(List.of(), List.of(4L), List.of(), List.of(), List.of(), false), "127.0.0.1", "test");
        assertThat(copied.getDocumentNo()).isNotEqualTo(originalDocumentNo);

        assertThatThrownBy(() -> draftService.create(request(List.of(1L), List.of(4L), List.of(), List.of(), List.of(), false), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> draftService.create(request(List.of(4L), List.of(4L), List.of(), List.of(), List.of(), false), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> draftService.create(request(List.of(), List.of(4L), List.of(4L), List.of(), List.of(), false), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void createRejectsInactiveOrLeaveAssignees() {
        currentEmp.set(emps.get(1L));
        ReflectionTestUtils.setField(emps.get(4L), "status", "LEAVE");

        assertThatThrownBy(() -> draftService.create(request(
            List.of(),
            List.of(4L),
            List.of(),
            List.of(),
            List.of(),
            false
        ), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("재직 중인 사용자만 결재선에 지정할 수 있습니다");

        ReflectionTestUtils.setField(emps.get(4L), "status", "ACTIVE");
        ReflectionTestUtils.setField(emps.get(5L), "useYn", "N");

        assertThatThrownBy(() -> draftService.create(request(
            List.of(),
            List.of(4L),
            List.of(),
            List.of(5L),
            List.of(),
            true
        ), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("재직 중인 사용자만 결재선에 지정할 수 있습니다");
    }

    @Test
    void dueReminderNotifiesAssigneeAndActiveDelegateOnce() {
        currentEmp.set(emps.get(1L));
        ApprovalDocument document = createdDocument(draftService.create(request(
            List.of(),
            List.of(4L),
            List.of(),
            List.of(),
            List.of(),
            false
        ), "127.0.0.1", "test").approvalId());
        ApprovalLine approvalLine = orderedLines(document).stream()
            .filter(ApprovalLine::isApproval)
            .findFirst()
            .orElseThrow();
        LocalDateTime now = LocalDateTime.of(2026, 6, 24, 10, 0);
        ReflectionTestUtils.setField(approvalLine, "dueAt", now.minusHours(1));
        ReflectionTestUtils.setField(approvalLine, "remindedAt", null);
        when(lineRepository.findDueForReminder(ApprovalLine.STATUS_PENDING, now)).thenReturn(List.of(approvalLine));
        when(delegationService.activeDelegatesFor(emps.get(4L))).thenReturn(List.of(emps.get(9L)));
        clearInvocations(notificationService);
        ApprovalOperationSettingService operationSettingService = mock(ApprovalOperationSettingService.class);
        when(operationSettingService.decisionDueHours()).thenReturn(72L);
        when(operationSettingService.reminderFixedDelayMs()).thenReturn(300000L);

        ApprovalReminderService service = new ApprovalReminderService(
            lineRepository,
            delegationService,
            notificationService,
            operationSettingService,
            mock(ScheduledJobStatusService.class)
        );

        assertThat(service.sendDueReminders(now)).isEqualTo(1);
        assertThat(approvalLine.getRemindedAt()).isNotNull();
        verify(notificationService, times(1)).notifyEmp(eq(4L), eq("전자결재 결재 지연"), anyString(), eq("APPROVAL"), eq(document.getApprovalId()));
        verify(notificationService, times(1)).notifyEmp(eq(9L), eq("전자결재 결재 지연"), anyString(), eq("APPROVAL"), eq(document.getApprovalId()));
    }

    @Test
    void dashboardCountsDirectDelegatedOverdueAndRequesterDocuments() {
        currentEmp.set(emps.get(1L));
        ApprovalDocument document = createdDocument(draftService.create(request(
            List.of(),
            List.of(4L),
            List.of(),
            List.of(),
            List.of(),
            false
        ), "127.0.0.1", "test").approvalId());
        ApprovalLine approvalLine = orderedLines(document).stream()
            .filter(ApprovalLine::isApproval)
            .findFirst()
            .orElseThrow();
        ReflectionTestUtils.setField(approvalLine, "dueAt", LocalDateTime.now().minusHours(1));

        when(delegationService.decisionAssigneesFor(emps.get(4L))).thenReturn(List.of(emps.get(4L)));
        currentEmp.set(emps.get(4L));
        assertThat(service.dashboard().myPendingCount()).isEqualTo(1);
        assertThat(service.dashboard().overdueCount()).isEqualTo(1);

        when(delegationService.decisionAssigneesFor(emps.get(9L))).thenReturn(List.of(emps.get(9L), emps.get(4L)));
        currentEmp.set(emps.get(9L));
        assertThat(service.dashboard().delegatedPendingCount()).isEqualTo(1);

        when(delegationService.decisionAssigneesFor(emps.get(1L))).thenReturn(List.of(emps.get(1L)));
        currentEmp.set(emps.get(1L));
        assertThat(service.dashboard().requestedInProgressCount()).isEqualTo(1);
    }

    @Test
    void adminDeleteUsesRetentionPolicyAndStatusCorrectionRestoresStage() {
        currentEmp.set(emps.get(1L));
        ApprovalDocument document = createdDocument(draftService.create(request(
            List.of(),
            List.of(4L),
            List.of(),
            List.of(),
            List.of(),
            false
        ), "127.0.0.1", "test").approvalId());

        ReflectionTestUtils.setField(emps.get(9L), "roleCode", "APPROVAL_ADMIN");
        currentEmp.set(emps.get(9L));
        assertThatThrownBy(() -> service.deleteForRetention(document.getApprovalId(), new ApprovalActionRequest("delete"), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("보존 대상");

        currentEmp.set(emps.get(4L));
        workflowService.reject(document.getApprovalId(), new ApprovalActionRequest("reject"), "127.0.0.1", "test");

        currentEmp.set(emps.get(1L));
        assertThatThrownBy(() -> service.deleteForRetention(document.getApprovalId(), new ApprovalActionRequest("requester delete"), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("전자결재 관리자");

        ReflectionTestUtils.setField(document, "currentStage", ApprovalDocument.STAGE_APPROVAL_PROGRESS);
        currentEmp.set(emps.get(9L));
        ApprovalResponse corrected = workflowService.correctStatus(document.getApprovalId(), new ApprovalActionRequest("fix stage"), "127.0.0.1", "test");
        assertThat(corrected.currentStage()).isEqualTo(ApprovalDocument.STAGE_REJECTED);

        service.deleteForRetention(document.getApprovalId(), new ApprovalActionRequest("archive rejected"), "127.0.0.1", "test");
        assertThat(document.getDeletedYn()).isEqualTo("Y");
        assertThat(document.getDeletedBy().getEmpId()).isEqualTo(9L);
    }

    @Test
    void submitRequiresTemplateRequiredFieldsButDraftAllowsMissingValues() {
        ApprovalTemplate template = ApprovalTemplate.builder()
            .templateCode("PURCHASE")
            .templateName("Purchase")
            .version(2)
            .fieldsJson("[{\"name\":\"purpose\",\"label\":\"기안 목적\",\"type\":\"textarea\",\"required\":true}]")
            .activeYn("Y")
            .build();
        when(templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(eq("PURCHASE"), eq("Y"))).thenReturn(Optional.of(template));

        currentEmp.set(emps.get(1L));
        ApprovalDocument draft = createdDocument(draftService.create(request(
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            List.of(),
            "{\"content\":\"draft\",\"fields\":{}}",
            true
        ), "127.0.0.1", "test").approvalId());
        assertThat(draft.getStatus()).isEqualTo(ApprovalDocument.STATUS_DRAFT);

        assertThatThrownBy(() -> draftService.create(request(
            List.of(),
            List.of(4L),
            List.of(),
            List.of(),
            List.of(),
            "{\"content\":\"submit\",\"fields\":{\"purpose\":\" \"}}",
            false
        ), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("기안 목적");

        ApprovalDocument submitted = createdDocument(draftService.create(request(
            List.of(),
            List.of(4L),
            List.of(),
            List.of(),
            List.of(),
            "{\"content\":\"submit\",\"fields\":{\"purpose\":\"필수값 입력\"}}",
            false
        ), "127.0.0.1", "test").approvalId());
        assertThat(submitted.getStatus()).isEqualTo(ApprovalDocument.STATUS_IN_PROGRESS);
    }

    @Test
    void leaveTemplateUsesLevDocumentNumberPrefix() {
        ApprovalTemplate template = ApprovalTemplate.builder()
            .templateCode("LEAVE")
            .templateName("휴가계")
            .version(1)
            .fieldsJson("[]")
            .activeYn("Y")
            .build();
        when(templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(eq("LEAVE"), eq("Y"))).thenReturn(Optional.of(template));

        currentEmp.set(emps.get(1L));
        ApprovalDocument submitted = createdDocument(draftService.create(new ApprovalRequest(
            "휴가계",
            "신청기간: 2026-06-23 ~ 2026-06-23 [ 1 일 ]",
            "LEAVE",
            "{\"content\":\"휴가계\",\"fields\":{\"startDate\":\"2026-06-23\",\"endDate\":\"2026-06-23\",\"days\":\"1\",\"annualLeaveDays\":\"1\",\"leaveType\":\"6/23 연차\"}}",
            "NORMAL",
            List.of(),
            List.of(4L),
            List.of(2L),
            List.of(),
            List.of(),
            false
        ), "127.0.0.1", "test").approvalId());

        assertThat(submitted.getDocumentNo()).startsWith("LEV-" + Year.now().getValue() + "-");
    }

    @Test
    void completedLeaveSelectionsAreReturnedAsUsedAnnualDays() {
        stubLeaveTemplate();

        currentEmp.set(emps.get(1L));
        ApprovalDocument document = createdDocument(draftService.create(leaveRequest(
            "2026-06-23",
            "\\uC624\\uD6C4\\uBC18\\uCC28"
        ), "127.0.0.1", "test").approvalId());

        currentEmp.set(emps.get(4L));
        workflowService.approve(document.getApprovalId(), new ApprovalActionRequest("approve"), "127.0.0.1", "test");

        currentEmp.set(emps.get(1L));
        LeaveUsageResponse usage = leaveUsageService.myUsage();

        assertThat(usage.usedAnnualDays()).isEqualTo("0.5");
        assertThat(usage.totalAnnualDays()).isEqualTo("16");
        assertThat(usage.remainingAnnualDays()).isEqualTo("15.5");
        assertThat(usage.selections()).hasSize(1);
        assertThat(usage.selections().get(0).date()).isEqualTo("2026-06-23");
        assertThat(usage.selections().get(0).type()).isEqualTo("오후반차");
    }

    @Test
    void finalApprovalRejectsLeaveDateAlreadyApproved() {
        stubLeaveTemplate();

        currentEmp.set(emps.get(1L));
        ApprovalDocument first = createdDocument(draftService.create(leaveRequest(
            "2026-06-23",
            "\\uC5F0\\uCC28"
        ), "127.0.0.1", "test").approvalId());

        currentEmp.set(emps.get(4L));
        workflowService.approve(first.getApprovalId(), new ApprovalActionRequest("approve"), "127.0.0.1", "test");

        currentEmp.set(emps.get(1L));
        assertThatThrownBy(() -> draftService.create(leaveRequest(
            "2026-06-23",
            "\\uC624\\uC804\\uBC18\\uCC28"
        ), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class)
            .hasMessageContaining("겹칩니다");
    }

    @Test
    void approvedLeaveCancelRestoresUsedAnnualDays() {
        stubLeaveTemplate();
        stubLeaveCancelTemplate();

        currentEmp.set(emps.get(1L));
        ApprovalDocument leave = createdDocument(draftService.create(leaveRequest(
            "2026-06-23",
            "\\uC5F0\\uCC28"
        ), "127.0.0.1", "test").approvalId());

        currentEmp.set(emps.get(4L));
        workflowService.approve(leave.getApprovalId(), new ApprovalActionRequest("approve"), "127.0.0.1", "test");

        currentEmp.set(emps.get(1L));
        ApprovalDocument cancel = createdDocument(draftService.create(leaveCancelRequest(
            "2026-06-23",
            "\\uC5F0\\uCC28",
            leave.getApprovalId()
        ), "127.0.0.1", "test").approvalId());
        assertThat(cancel.getDocumentNo()).startsWith("LVC-" + Year.now().getValue() + "-");

        currentEmp.set(emps.get(4L));
        workflowService.approve(cancel.getApprovalId(), new ApprovalActionRequest("approve"), "127.0.0.1", "test");

        currentEmp.set(emps.get(1L));
        LeaveUsageResponse usage = leaveUsageService.myUsage();

        assertThat(usage.usedAnnualDays()).isEqualTo("0");
        assertThat(usage.remainingAnnualDays()).isEqualTo("16");
        assertThat(usage.selections()).isEmpty();
    }

    @Test
    void leaveCancelSubmissionRequiresOneReceiver() {
        stubLeaveCancelTemplate();
        currentEmp.set(emps.get(1L));

        assertThatThrownBy(() -> draftService.create(leaveCancelRequest(
            "2026-06-23",
            "\\uC5F0\\uCC28",
            101L,
            List.of()
        ), "127.0.0.1", "test"))
            .isInstanceOfSatisfying(BusinessException.class, ex ->
                assertThat(ex.getCode()).isEqualTo("LEAVE_RECEIVER_REQUIRED")
            );
    }

    @Test
    void educationCalendarAndReportReceiptFlow() {
        currentEmp.set(emps.get(1L));
        ApprovalDocument course = education("TRAINING_REQUEST", courseFields(-3, -1), false);
        assertThat(trainingWorkflowService.mine(null, null, null)).isEmpty();
        currentEmp.set(emps.get(4L)); workflowService.approve(course.getApprovalId(), null, "test", "test");
        currentEmp.set(emps.get(1L)); assertThat(trainingWorkflowService.mine(null, null, null)).isEmpty();
        finishEducationHostingDepartment(course);
        String original = course.getFormDataJson();
        assertThat(trainingWorkflowService.mine(null, null, null)).singleElement().satisfies(i -> {
            assertThat(i.status()).isEqualTo("ENDED"); assertThat(i.reportable()).isTrue();
        });
        Map<String,String> fields = linkedFields(course); fields.put("mainContent", "Learning summary");
        fields.put("trainingName", "Forged source name");
        ApprovalDocument report = education("TRAINING_REPORT", fields, false);
        assertThat(report.getFormDataJson()).contains("Original course").doesNotContain("Forged source name");
        currentEmp.set(emps.get(4L)); workflowService.approve(report.getApprovalId(), null, "test", "test");
        assertThat(report.getStatus()).isEqualTo("IN_PROGRESS");
        currentEmp.set(emps.get(6L));
        assertThat(permissionService.permissions(emps.get(6L), report, orderedLines(report)).canCompleteReceipt()).isTrue();
        assertThatThrownBy(() -> workflowService.submitPurchaseApproval(report.getApprovalId(), new PurchaseRequestUpdateRequest(null, List.of(), List.of(7L)), "test", "test"))
            .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getCode()).isEqualTo("TRAINING_REPORT_RECEIPT_ONLY"));
        workflowService.receive(report.getApprovalId(), "test", "test");
        assertThat(report.getStatus()).isEqualTo("IN_PROGRESS");
        workflowService.completeReceipt(report.getApprovalId(), new ApprovalActionRequest("Received"), "test", "test");
        assertThat(report.getStatus()).isEqualTo("APPROVED");
        currentEmp.set(emps.get(1L));
        assertThat(trainingWorkflowService.mine(null, null, null)).singleElement().satisfies(i -> {
            assertThat(i.status()).isEqualTo("COMPLETED"); assertThat(i.changeable()).isFalse(); assertThat(i.reportable()).isFalse();
        });
        assertThat(course.getFormDataJson()).isEqualTo(original);
        assertThat(course.getStatus()).isEqualTo("APPROVED");
        verify(pdfService, times(1)).generateForFinalApproval(report);
    }

    @Test
    void pastEducationChangesAndCancelsWithoutChangingOriginal() {
        currentEmp.set(emps.get(1L)); ApprovalDocument course = approvedEducation(-5, -4);
        String original = course.getFormDataJson();
        Map<String,String> fields = linkedFields(course); fields.putAll(courseFields(-3, -2));
        fields.put("changeAction", "CHANGE"); fields.put("changeReason", "Correction"); fields.put("trainingName", "Corrected course");
        ApprovalDocument change = education("TRAINING_CHANGE", fields, false);
        assertThat(trainingWorkflowService.mine(null, null, null)).singleElement().satisfies(i -> {
            assertThat(i.trainingName()).isEqualTo("Original course"); assertThat(i.reportable()).isFalse();
        });
        assertThatThrownBy(() -> education("TRAINING_REPORT", linkedFields(course), true)).isInstanceOf(BusinessException.class);
        approveEducationBothDepartments(change);
        assertThat(trainingWorkflowService.mine(null, null, null)).singleElement().satisfies(i -> assertThat(i.trainingName()).isEqualTo("Corrected course"));
        Map<String,String> cancel = linkedFields(course); cancel.put("sourceTrainingRevisionId", change.getApprovalId().toString());
        cancel.put("changeAction", "CANCEL"); cancel.put("changeReason", "Did not attend");
        ApprovalDocument cancellation = education("TRAINING_CHANGE", cancel, false); approveEducationBothDepartments(cancellation);
        assertThat(trainingWorkflowService.mine(java.time.LocalDate.now().minusMonths(1), java.time.LocalDate.now().plusMonths(1), null)).isEmpty();
        assertThat(trainingWorkflowService.mine(null, null, null)).singleElement().satisfies(i -> assertThat(i.status()).isEqualTo("CANCELED"));
        assertThat(course.getFormDataJson()).isEqualTo(original); assertThat(course.getStatus()).isEqualTo("APPROVED");
    }

    @Test
    void reportDraftLocksChangesAndBlocksDuplicatesAndOtherOwners() {
        currentEmp.set(emps.get(1L)); ApprovalDocument course = approvedEducation(-3, -1);
        ApprovalDocument report = education("TRAINING_REPORT", linkedFields(course), true);
        assertThatThrownBy(() -> education("TRAINING_REPORT", linkedFields(course), true)).isInstanceOf(BusinessException.class);
        Map<String,String> cancel = linkedFields(course); cancel.put("changeAction", "CANCEL"); cancel.put("changeReason", "Cancel");
        assertThatThrownBy(() -> education("TRAINING_CHANGE", cancel, true)).isInstanceOf(BusinessException.class);
        workflowService.cancel(report.getApprovalId(), "test", "test");
        assertThatThrownBy(() -> education("TRAINING_CHANGE", cancel, true)).isInstanceOf(BusinessException.class);
        currentEmp.set(emps.get(2L)); assertThat(trainingWorkflowService.mine(null, null, null)).isEmpty();
        assertThatThrownBy(() -> education("TRAINING_REPORT", linkedFields(course), true))
            .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getCode()).isEqualTo("TRAINING_SOURCE_INVALID"));
    }

    @Test
    void withdrawingOrRejectingChangeReleasesReportRestriction() {
        currentEmp.set(emps.get(1L)); ApprovalDocument course = approvedEducation(-3, -1);
        Map<String,String> fields = linkedFields(course); fields.put("changeAction", "CANCEL"); fields.put("changeReason", "Cancel");
        ApprovalDocument change = education("TRAINING_CHANGE", fields, false);
        workflowService.withdraw(change.getApprovalId(), null, "test", "test");
        assertThat(trainingWorkflowService.mine(null, null, null)).singleElement().satisfies(i -> assertThat(i.reportable()).isTrue());
        ApprovalDocument retry = education("TRAINING_CHANGE", fields, false);
        currentEmp.set(emps.get(4L)); workflowService.reject(retry.getApprovalId(), new ApprovalActionRequest("Rejected"), "test", "test");
        currentEmp.set(emps.get(1L));
        assertThat(trainingWorkflowService.mine(null, null, null)).singleElement().satisfies(i -> assertThat(i.reportable()).isTrue());
    }

    @Test
    void reportBeforeCourseEndAndPurchaseMutationAreBlocked() {
        currentEmp.set(emps.get(1L)); ApprovalDocument course = approvedEducation(1, 2);
        assertThatThrownBy(() -> education("TRAINING_REPORT", linkedFields(course), true)).isInstanceOf(BusinessException.class);
        currentEmp.set(emps.get(6L));
        assertThatThrownBy(() -> workflowService.updatePurchaseRequest(course.getApprovalId(), new PurchaseRequestUpdateRequest("2026-12-01", null, null), "test", "test"))
            .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getCode()).isEqualTo("APPROVAL_PURCHASE_ONLY"));
    }

    private Map<String,String> courseFields(int start, int end) {
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Seoul"));
        return new HashMap<>(Map.of("trainingName", "Original course", "institution", "Training center", "reason", "Skills",
            "trainingStartDate", today.plusDays(start).toString(), "trainingEndDate", today.plusDays(end).toString()));
    }
    private Map<String,String> linkedFields(ApprovalDocument d) { return new HashMap<>(Map.of("sourceTrainingApprovalId", d.getApprovalId().toString(), "sourceTrainingRevisionId", d.getApprovalId().toString())); }
    private ApprovalDocument education(String code, Map<String,String> values, boolean draft) {
        try {
            String json = new ObjectMapper().writeValueAsString(Map.of("fields", values));
            return createdDocument(draftService.create(new ApprovalRequest(code, "Education", code, json, "NORMAL", List.of(), List.of(4L), List.of(6L), List.of(), List.of(), draft), "test", "test").approvalId());
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new AssertionError(e); }
    }
    private ApprovalDocument approvedEducation(int start, int end) { ApprovalDocument d = education("TRAINING_REQUEST", courseFields(start,end), false); approveEducationBothDepartments(d); return d; }
    private void approveEducationBothDepartments(ApprovalDocument d) { currentEmp.set(emps.get(4L)); workflowService.approve(d.getApprovalId(), null, "test", "test"); finishEducationHostingDepartment(d); }
    private void finishEducationHostingDepartment(ApprovalDocument d) {
        currentEmp.set(emps.get(6L)); workflowService.submitPurchaseApproval(d.getApprovalId(), new PurchaseRequestUpdateRequest(null, List.of(), List.of(7L)), "test", "test");
        currentEmp.set(emps.get(7L)); workflowService.approve(d.getApprovalId(), null, "test", "test"); currentEmp.set(emps.get(1L));
    }


    private ApprovalRequest request(
        List<Long> agreementEmpIds,
        List<Long> approverEmpIds,
        List<Long> receiverEmpIds,
        List<Long> referenceEmpIds,
        List<Long> readerEmpIds,
        boolean draft
    ) {
        return new ApprovalRequest(
            "Purchase request",
            "content",
            "PURCHASE",
            "{\"content\":\"content\"}",
            "NORMAL",
            agreementEmpIds,
            approverEmpIds,
            receiverEmpIds,
            referenceEmpIds,
            readerEmpIds,
            draft
        );
    }

    private ApprovalRequest requestForTemplate(
        String templateCode,
        List<Long> agreementEmpIds,
        List<Long> approverEmpIds,
        List<Long> receiverEmpIds,
        List<Long> referenceEmpIds,
        List<Long> readerEmpIds,
        boolean draft
    ) {
        return new ApprovalRequest(
            templateCode + " request",
            "content",
            templateCode,
            "{\"content\":\"content\"}",
            "NORMAL",
            agreementEmpIds,
            approverEmpIds,
            receiverEmpIds,
            referenceEmpIds,
            readerEmpIds,
            draft
        );
    }

    private ApprovalRequest request(
        List<Long> agreementEmpIds,
        List<Long> approverEmpIds,
        List<Long> receiverEmpIds,
        List<Long> referenceEmpIds,
        List<Long> readerEmpIds,
        String formDataJson,
        boolean draft
    ) {
        return new ApprovalRequest(
            "Purchase request",
            "content",
            "PURCHASE",
            formDataJson,
            "NORMAL",
            agreementEmpIds,
            approverEmpIds,
            receiverEmpIds,
            referenceEmpIds,
            readerEmpIds,
            draft
        );
    }

    private void stubLeaveTemplate() {
        ApprovalTemplate template = ApprovalTemplate.builder()
            .templateCode("LEAVE")
            .templateName("Leave")
            .version(1)
            .fieldsJson("[]")
            .activeYn("Y")
            .build();
        when(templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(eq("LEAVE"), eq("Y"))).thenReturn(Optional.of(template));
    }

    private void stubLeaveCancelTemplate() {
        ApprovalTemplate template = ApprovalTemplate.builder()
            .templateCode("LEAVE_CANCEL")
            .templateName("Leave cancel")
            .version(1)
            .fieldsJson("[]")
            .activeYn("Y")
            .build();
        when(templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(eq("LEAVE_CANCEL"), eq("Y"))).thenReturn(Optional.of(template));
    }

    private ApprovalRequest leaveRequest(String date, String escapedType) {
        String shortDate = date.substring(5).replace("-0", "/").replace("-", "/");
        String formDataJson = "{\"content\":\"leave\",\"fields\":{\"startDate\":\"" + date
            + "\",\"endDate\":\"" + date
            + "\",\"days\":\"1\",\"annualLeaveDays\":\"1\",\"leaveType\":\"" + shortDate + " " + escapedType
            + "\",\"leaveSelectionsJson\":\"[{\\\"date\\\":\\\"" + date
            + "\\\",\\\"type\\\":\\\"" + escapedType
            + "\\\",\\\"days\\\":1}]\"}}";
        return new ApprovalRequest(
            "Leave",
            "content",
            "LEAVE",
            formDataJson,
            "NORMAL",
            List.of(),
            List.of(4L),
            List.of(2L),
            List.of(),
            List.of(),
            false
        );
    }

    private ApprovalRequest leaveCancelRequest(String date, String escapedType, Long sourceApprovalId) {
        return leaveCancelRequest(date, escapedType, sourceApprovalId, List.of(2L));
    }

    private ApprovalRequest leaveCancelRequest(String date, String escapedType, Long sourceApprovalId, List<Long> receiverEmpIds) {
        String shortDate = date.substring(5).replace("-0", "/").replace("-", "/");
        String formDataJson = "{\"content\":\"cancel\",\"fields\":{\"startDate\":\"" + date
            + "\",\"endDate\":\"" + date
            + "\",\"days\":\"1\",\"annualLeaveDays\":\"1\",\"leaveType\":\"" + shortDate + " " + escapedType
            + "\",\"leaveSelectionsJson\":\"[{\\\"date\\\":\\\"" + date
            + "\\\",\\\"type\\\":\\\"" + escapedType
            + "\\\",\\\"days\\\":1,\\\"sourceApprovalId\\\":" + sourceApprovalId
            + ",\\\"sourceDocumentNo\\\":\\\"LEV-2026-0001\\\"}]\"}}";
        return new ApprovalRequest(
            "Leave cancel",
            "content",
            "LEAVE_CANCEL",
            formDataJson,
            "NORMAL",
            List.of(),
            List.of(4L),
            receiverEmpIds,
            List.of(),
            List.of(),
            false
        );
    }

    private ApprovalDocument createdDocument(Long approvalId) {
        return documents.get(approvalId);
    }

    private List<ApprovalLine> orderedLines(ApprovalDocument document) {
        return lines.stream()
            .filter(line -> line.getDocument() == document)
            .sorted(Comparator.comparing(ApprovalLine::getLineOrder))
            .toList();
    }

    private Emp newEmp() {
        try {
            java.lang.reflect.Constructor<Emp> constructor = Emp.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            return constructor.newInstance();
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
