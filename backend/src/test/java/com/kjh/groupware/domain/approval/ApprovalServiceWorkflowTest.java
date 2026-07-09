package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
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
import com.kjh.groupware.domain.emp.EmpSignatureService;
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
    private final ApprovalEquipmentProposalService equipmentProposalService = mock(ApprovalEquipmentProposalService.class);
    private final ApprovalDelegationService delegationService = mock(ApprovalDelegationService.class);
    private final ApprovalReminderService reminderService = mock(ApprovalReminderService.class);
    private final ApprovalPermissionService permissionService = new ApprovalPermissionService(delegationService);
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
                .toList();
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
        ApprovalLinePolicyService linePolicyService = new ApprovalLinePolicyService(
            lineRepository,
            empRepository,
            delegationService,
            reminderService
        );
        leaveUsageService = new ApprovalLeaveUsageService(
            documentRepository,
            currentEmpProvider,
            new ObjectMapper()
        );
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
            new ObjectMapper()
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
        ApprovalDocument document = createdDocument(draftService.create(requestForTemplate(
            "TRAINING_REPORT",
            List.of(),
            List.of(4L),
            List.of(6L),
            List.of(),
            List.of(),
            false
        ), "127.0.0.1", "test").approvalId());

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
                ApprovalLine.STATUS_SKIPPED,
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
            operationSettingService
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
            List.of(),
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
            .hasMessageContaining("already approved");
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
            "\\uC5F0\\uCC28"
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
            List.of(),
            List.of(),
            List.of(),
            false
        );
    }

    private ApprovalRequest leaveCancelRequest(String date, String escapedType) {
        String shortDate = date.substring(5).replace("-0", "/").replace("-", "/");
        String formDataJson = "{\"content\":\"cancel\",\"fields\":{\"startDate\":\"" + date
            + "\",\"endDate\":\"" + date
            + "\",\"days\":\"1\",\"annualLeaveDays\":\"1\",\"leaveType\":\"" + shortDate + " " + escapedType
            + "\",\"leaveSelectionsJson\":\"[{\\\"date\\\":\\\"" + date
            + "\\\",\\\"type\\\":\\\"" + escapedType
            + "\\\",\\\"days\\\":1}]\"}}";
        return new ApprovalRequest(
            "Leave cancel",
            "content",
            "LEAVE_CANCEL",
            formDataJson,
            "NORMAL",
            List.of(),
            List.of(4L),
            List.of(),
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
