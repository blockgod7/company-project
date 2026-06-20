package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.dto.ApprovalActionRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.emp.EmpSignatureService;
import com.kjh.groupware.domain.notification.Notification;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
    private final ApprovalPermissionService permissionService = new ApprovalPermissionService();
    private final JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
    private final AtomicReference<Emp> currentEmp = new AtomicReference<>();
    private final AtomicLong documentIds = new AtomicLong(100);
    private final AtomicLong lineIds = new AtomicLong(1000);
    private final AtomicInteger documentSequence = new AtomicInteger(0);
    private final Map<Long, Emp> emps = new HashMap<>();
    private final Map<Long, ApprovalDocument> documents = new HashMap<>();
    private final List<ApprovalLine> lines = new ArrayList<>();

    private ApprovalService service;

    @BeforeEach
    void setUp() {
        for (long id = 1; id <= 9; id++) {
            Emp emp = newEmp();
            ReflectionTestUtils.setField(emp, "empId", id);
            ReflectionTestUtils.setField(emp, "empNo", "E" + id);
            ReflectionTestUtils.setField(emp, "empName", "User" + id);
            ReflectionTestUtils.setField(emp, "roleCode", "USER");
            ReflectionTestUtils.setField(emp, "positionName", "Staff");
            emps.put(id, emp);
        }

        ApprovalTemplate template = ApprovalTemplate.builder()
            .templateCode("PURCHASE")
            .templateName("Purchase")
            .version(1)
            .fieldsJson("{}")
            .activeYn("Y")
            .build();

        when(currentEmpProvider.getCurrentEmp()).thenAnswer(invocation -> currentEmp.get());
        when(templateRepository.findTopByTemplateCodeAndActiveYnOrderByVersionDesc(eq("PURCHASE"), eq("Y"))).thenReturn(Optional.of(template));
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
        org.mockito.Mockito.doAnswer(invocation -> {
            ApprovalDocument document = invocation.getArgument(0);
            lines.removeIf(line -> line.getDocument() == document);
            return null;
        }).when(lineRepository).deleteByDocument(any());
        when(signatureService.snapshotJson(any())).thenReturn("{}");
        when(signatureService.activeSignatureFile(any())).thenReturn(null);
        when(notificationService.notifyEmp(any(), anyString(), anyString(), anyString(), any())).thenReturn(mock(Notification.class));

        service = new ApprovalService(
            documentRepository,
            lineRepository,
            templateRepository,
            empRepository,
            currentEmpProvider,
            auditLogService,
            notificationService,
            signatureService,
            pdfService,
            permissionService,
            jdbcTemplate,
            new ObjectMapper()
        );
    }

    @Test
    void agreementApprovalReceiptAndShareFlow() {
        currentEmp.set(emps.get(1L));
        Long approvalId = service.create(request(
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
        assertThat(documentLines).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_WAITING, ApprovalLine.STATUS_WAITING);

        currentEmp.set(emps.get(2L));
        service.approve(document.getApprovalId(), new ApprovalActionRequest("agree"), "127.0.0.1", "test");
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_WAITING, ApprovalLine.STATUS_WAITING);

        currentEmp.set(emps.get(3L));
        service.approve(document.getApprovalId(), new ApprovalActionRequest("agree"), "127.0.0.1", "test");
        assertThat(document.getCurrentStage()).isEqualTo(ApprovalDocument.STAGE_APPROVAL_PROGRESS);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_PENDING, ApprovalLine.STATUS_WAITING);

        currentEmp.set(emps.get(4L));
        service.approve(document.getApprovalId(), new ApprovalActionRequest("approve"), "127.0.0.1", "test");
        assertThatThrownBy(() -> service.approve(document.getApprovalId(), new ApprovalActionRequest("again"), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isApproval).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_APPROVED, ApprovalLine.STATUS_PENDING);

        currentEmp.set(emps.get(5L));
        service.approve(document.getApprovalId(), new ApprovalActionRequest("approve"), "127.0.0.1", "test");
        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_APPROVED);
        assertThat(document.getCurrentStage()).isEqualTo(ApprovalDocument.STAGE_COMPLETED);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isReceiver).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_RECEIVED);
        assertThat(orderedLines(document)).filteredOn(line -> line.isReference() || line.isReader()).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_READ, ApprovalLine.STATUS_READ);

        currentEmp.set(emps.get(1L));
        assertThat(service.findOne(document.getApprovalId(), "127.0.0.1", "test").permissions().canView()).isTrue();
        currentEmp.set(emps.get(6L));
        assertThat(service.findOne(document.getApprovalId(), "127.0.0.1", "test").permissions().canCompleteReceipt()).isTrue();
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
        service.receive(document.getApprovalId(), "127.0.0.1", "test");
        assertThatThrownBy(() -> service.receive(document.getApprovalId(), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        service.completeReceipt(document.getApprovalId(), new ApprovalActionRequest("done"), "127.0.0.1", "test");
        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_APPROVED);
        assertThat(orderedLines(document)).filteredOn(ApprovalLine::isReceiver).extracting(ApprovalLine::getStatus)
            .containsExactly(ApprovalLine.STATUS_RECEIPT_COMPLETED);
        assertThatThrownBy(() -> service.completeReceipt(document.getApprovalId(), new ApprovalActionRequest("again"), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void noAgreementStartsFirstApproverAndRejectSkipsFutureLines() {
        currentEmp.set(emps.get(1L));
        ApprovalDocument document = createdDocument(service.create(request(
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
        assertThatThrownBy(() -> service.reject(document.getApprovalId(), new ApprovalActionRequest(" "), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        service.reject(document.getApprovalId(), new ApprovalActionRequest("not acceptable"), "127.0.0.1", "test");

        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_REJECTED);
        assertThat(orderedLines(document)).extracting(ApprovalLine::getStatus)
            .containsExactly(
                ApprovalLine.STATUS_REJECTED,
                ApprovalLine.STATUS_SKIPPED,
                ApprovalLine.STATUS_SKIPPED,
                ApprovalLine.STATUS_SKIPPED,
                ApprovalLine.STATUS_SKIPPED
            );
        assertThatThrownBy(() -> service.approve(document.getApprovalId(), new ApprovalActionRequest("late"), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
    }

    @Test
    void withdrawResubmitRedraftAndSelectionValidation() {
        currentEmp.set(emps.get(1L));
        ApprovalDocument document = createdDocument(service.create(request(
            List.of(),
            List.of(4L, 5L),
            List.of(),
            List.of(),
            List.of(),
            false
        ), "127.0.0.1", "test").approvalId());
        String originalDocumentNo = document.getDocumentNo();

        service.withdraw(document.getApprovalId(), new ApprovalActionRequest("fix"), "127.0.0.1", "test");
        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_WITHDRAWN);
        service.submit(document.getApprovalId(), request(List.of(), List.of(4L, 5L), List.of(), List.of(), List.of(), false), "127.0.0.1", "test");
        assertThat(document.getDocumentNo()).isEqualTo(originalDocumentNo);
        assertThat(document.getStatus()).isEqualTo(ApprovalDocument.STATUS_IN_PROGRESS);

        currentEmp.set(emps.get(4L));
        service.approve(document.getApprovalId(), new ApprovalActionRequest("ok"), "127.0.0.1", "test");
        currentEmp.set(emps.get(1L));
        assertThatThrownBy(() -> service.withdraw(document.getApprovalId(), new ApprovalActionRequest("too late"), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);

        currentEmp.set(emps.get(5L));
        service.reject(document.getApprovalId(), new ApprovalActionRequest("reject"), "127.0.0.1", "test");
        currentEmp.set(emps.get(1L));
        ApprovalDocument copied = createdDocument(service.redraft(document.getApprovalId(), "127.0.0.1", "test").approvalId());
        assertThat(copied.getStatus()).isEqualTo(ApprovalDocument.STATUS_DRAFT);
        assertThat(copied.getDocumentNo()).isNull();
        service.submit(copied.getApprovalId(), request(List.of(), List.of(4L), List.of(), List.of(), List.of(), false), "127.0.0.1", "test");
        assertThat(copied.getDocumentNo()).isNotEqualTo(originalDocumentNo);

        assertThatThrownBy(() -> service.create(request(List.of(1L), List.of(4L), List.of(), List.of(), List.of(), false), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.create(request(List.of(4L), List.of(4L), List.of(), List.of(), List.of(), false), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.create(request(List.of(), List.of(4L), List.of(4L), List.of(), List.of(), false), "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
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
