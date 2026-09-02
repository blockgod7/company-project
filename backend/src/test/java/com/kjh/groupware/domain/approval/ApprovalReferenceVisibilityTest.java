package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.domain.file.AttachFile;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import java.time.LocalDateTime;
import java.util.List;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.support.JpaRepositoryFactory;
import org.springframework.test.util.ReflectionTestUtils;

class ApprovalReferenceVisibilityTest {
    private static EntityManagerFactory factory;
    private EntityManager em;
    private ApprovalDocumentRepository documents;
    private ApprovalLineRepository lines;
    private Emp requester, reference, receiver, reader, outsider;
    private final ApprovalPermissionService permissions = new ApprovalPermissionService(
        mock(ApprovalDelegationService.class), mock(TrainingWorkflowService.class), mock(EmployeePermissionService.class));

    @BeforeAll
    static void database() {
        factory = new Configuration()
            .addAnnotatedClass(ApprovalDocument.class).addAnnotatedClass(ApprovalLine.class)
            .addAnnotatedClass(Emp.class).addAnnotatedClass(Dept.class).addAnnotatedClass(AttachFile.class)
            .setProperty("hibernate.connection.driver_class", "org.h2.Driver")
            .setProperty("hibernate.connection.url", "jdbc:h2:mem:referenceVisibility;DB_CLOSE_DELAY=-1")
            .setProperty("hibernate.hbm2ddl.auto", "create-drop")
            .setProperty("hibernate.show_sql", "false")
            .buildSessionFactory();
        // Production schema supplies these defaults; Hibernate's test DDL does not.
        try (EntityManager schema = factory.createEntityManager()) {
            schema.getTransaction().begin();
            for (String table : List.of("emp", "approval_document", "approval_line")) {
                schema.createNativeQuery("alter table " + table + " alter column created_at set default current_timestamp").executeUpdate();
            }
            schema.getTransaction().commit();
        }
    }

    @AfterAll
    static void closeDatabase() { factory.close(); }

    @BeforeEach
    void setup() {
        em = factory.createEntityManager();
        em.getTransaction().begin();
        JpaRepositoryFactory repositories = new JpaRepositoryFactory(em);
        documents = repositories.getRepository(ApprovalDocumentRepository.class);
        lines = repositories.getRepository(ApprovalLineRepository.class);
        requester = employee("requester");
        reference = employee("reference");
        receiver = employee("receiver");
        reader = employee("reader");
        outsider = employee("outsider");
    }

    @AfterEach
    void rollback() { em.getTransaction().rollback(); em.close(); }

    @ParameterizedTest
    @CsvSource({"DRAFT,false", "IN_PROGRESS,true", "APPROVED,true", "REJECTED,true", "WITHDRAWN,false", "CANCELED,false"})
    void referencePermissionMailboxSearchAndCompletedHistoryAgree(String status, boolean visible) {
        ApprovalDocument doc = document(status);
        ApprovalLine referenceLine = line(doc, reference, "REFERENCE");
        List<ApprovalLine> docLines = List.of(referenceLine, line(doc, receiver, "RECEIVER"), line(doc, reader, "READER"));
        boolean active = "IN_PROGRESS".equals(status);
        // Waiting, share-opened, and actually-read references use the same lifecycle boundaries.
        for (int pass = 0; pass < 3; pass++) {
            if (pass == 1) referenceLine.openShared();
            if (pass == 2) referenceLine.markReferenceRead(reference);
            em.flush();
            var access = permissions.permissions(reference, doc, docLines);
            assertThat(access.canView()).isEqualTo(visible);
            assertThat(access.canDownloadAttachment()).isEqualTo(visible);
            assertThat(access.canApprove()).isFalse();
            assertThat(access.canReject()).isFalse();
            assertThat(access.canReceive()).isFalse();
            assertThat(access.canCompleteReceipt()).isFalse();
            assertThat(access.canPrintPdf()).isFalse();
            assertThat(documents.findSharedDocuments(reference, PageRequest.of(0, 10)).getTotalElements()).isEqualTo(active ? 1 : 0);
            assertThat(search(reference, false).getTotalElements()).isEqualTo(active ? 1 : 0);
            assertThat(search(reference, true).getTotalElements()).isEqualTo(visible ? 1 : 0);
            assertThat(documents.findVisibleToApprover(reference, PageRequest.of(0, 10)).getTotalElements()).isEqualTo(visible ? 1 : 0);
            for (String role : List.of("ALL", "SHARED")) {
                assertThat(documents.findCompletedInvolved(false, "", false, "", false, "", false, requester,
                    reference, role, false, LocalDateTime.now(), false, LocalDateTime.now(), PageRequest.of(0, 10)).getTotalElements())
                    .isEqualTo(List.of("APPROVED", "REJECTED").contains(status) ? 1 : 0);
            }
            assertThat(documents.findActionRequiredDocuments(List.of(reference), reference, PageRequest.of(0, 10)).getContent()).isEmpty();
            assertThat(permissions.permissions(outsider, doc, docLines).canView()).isFalse();
            assertThat(documents.findSharedDocuments(outsider, PageRequest.of(0, 10)).getContent()).isEmpty();
            if ("IN_PROGRESS".equals(status)) {
                assertThat(permissions.permissions(receiver, doc, docLines).canView()).isFalse();
                assertThat(permissions.permissions(reader, doc, docLines).canView()).isFalse();
                assertThat(lines.findOpenReceiverInboxLines(receiver, PageRequest.of(0, 10)).getContent()).isEmpty();
                assertThat(documents.findSharedDocuments(reader, PageRequest.of(0, 10)).getContent()).isEmpty();
            }
        }
    }

    @Test
    void paginationCountsDistinctDocumentsAndExcludesDeletedOnes() {
        for (int i = 0; i < 3; i++) {
            ApprovalDocument doc = document("IN_PROGRESS");
            line(doc, reference, "REFERENCE").openShared();
            line(doc, reference, "READER").openShared();
        }
        ApprovalDocument deleted = document("IN_PROGRESS");
        ReflectionTestUtils.setField(deleted, "deletedYn", "Y");
        line(deleted, reference, "REFERENCE").openShared();
        em.flush();
        var first = documents.findSharedDocuments(reference, PageRequest.of(0, 1));
        var second = documents.findSharedDocuments(reference, PageRequest.of(1, 1));
        assertThat(first.getTotalElements()).isEqualTo(3);
        assertThat(second.getTotalElements()).isEqualTo(3);
        assertThat(first.getContent().getFirst().getApprovalId()).isGreaterThan(second.getContent().getFirst().getApprovalId());
        assertThat(search(reference, false).getTotalElements()).isEqualTo(3);
    }

    @Test
    void receiverAndReaderStillOpenAfterFinalApprovalAndPdfRequiresGeneratedFile() {
        ApprovalDocument doc = document("IN_PROGRESS");
        ApprovalLine ref = line(doc, reference, "REFERENCE");
        ApprovalLine receive = line(doc, receiver, "RECEIVER");
        ApprovalLine read = line(doc, reader, "READER");
        List<ApprovalLine> docLines = List.of(ref, receive, read);
        doc.approve();
        receive.markReceived();
        read.openShared();
        em.flush();
        assertThat(lines.findOpenReceiverInboxLines(receiver, PageRequest.of(0, 10)).getTotalElements()).isEqualTo(1);
        assertThat(documents.findSharedDocuments(reader, PageRequest.of(0, 10)).getTotalElements()).isZero();
        assertThat(documents.findCompletedInvolved(false, "", false, "", false, "", false, requester,
            reader, "SHARED", false, LocalDateTime.now(), false, LocalDateTime.now(), PageRequest.of(0, 10)).getTotalElements()).isEqualTo(1);
        assertThat(permissions.permissions(receiver, doc, docLines).canReceive()).isTrue();
        assertThat(permissions.permissions(reference, doc, docLines).canPrintPdf()).isFalse();
        ReflectionTestUtils.setField(doc, "pdfFile", mock(AttachFile.class));
        ReflectionTestUtils.setField(doc, "pdfStatus", ApprovalDocument.PDF_STATUS_GENERATED);
        assertThat(permissions.permissions(reference, doc, docLines).canPrintPdf()).isTrue();
        ReflectionTestUtils.setField(doc, "status", "IN_PROGRESS");
        assertThat(permissions.permissions(reference, doc, docLines).canPrintPdf()).isFalse();
    }

    private Page<ApprovalDocument> search(Emp actor, boolean global) {
        return documents.searchVisible(true, "reference-fixture", false, "", false, "", false, requester, actor,
            List.of(actor), false, false, false, false, false, !global, false, false, false, global,
            false, LocalDateTime.now(), false, LocalDateTime.now(), PageRequest.of(0, 10));
    }

    @ParameterizedTest
    @CsvSource({"APPROVED", "REJECTED"})
    void openingReferenceRecordsFirstReadButOnlyResolutionMovesItToCompleted(String resolution) {
        ApprovalDocument doc = document("IN_PROGRESS");
        ApprovalLine ref = line(doc, reference, "REFERENCE");
        ApprovalLine otherRef = line(doc, outsider, "REFERENCE");
        ApprovalLine receive = line(doc, receiver, "RECEIVER");
        em.flush();
        CurrentEmpProvider current = mock(CurrentEmpProvider.class);
        when(current.getCurrentEmp()).thenReturn(reference);
        ApprovalQueryService query = new ApprovalQueryService(documents, lines, mock(EmpRepository.class),
            current, mock(AuditLogService.class), permissions, mock(ApprovalDelegationService.class));
        query.findOne(doc.getApprovalId(), "test", "test");
        LocalDateTime firstRead = ref.getReadAt();
        assertThat(firstRead).isNotNull();
        assertThat(otherRef.getReadAt()).isNull();
        assertThat(receive.getReadAt()).isNull();
        query.findOne(doc.getApprovalId(), "test", "test");
        assertThat(ref.getReadAt()).isEqualTo(firstRead);
        assertThat(documents.findSharedDocuments(reference, PageRequest.of(0, 10)).getTotalElements()).isEqualTo(1);
        if ("APPROVED".equals(resolution)) doc.approve(); else doc.reject();
        em.flush();
        assertThat(query.findPage("shared", 0, 10, null, null, null, null, null, null, null, null).content()).isEmpty();
        assertThat(query.findPage("shared", 0, 10, "reference-fixture", null, null, null, null, null, null, null).content()).isEmpty();
        assertThat(query.findPage("processed", 0, 10, null, null, null, null, null, null, "completedInvolved", "SHARED").content())
            .extracting("approvalId").containsExactly(doc.getApprovalId());
        assertThat(query.findOne(doc.getApprovalId(), "test", "test").permissions().canView()).isTrue();
        assertThat(ref.getReadAt()).isEqualTo(firstRead);
        doc.withdraw("fixture");
        em.flush();
        assertThatThrownBy(() -> query.findOne(doc.getApprovalId(), "test", "test")).isInstanceOf(BusinessException.class);
        assertThat(query.findPage("processed", 0, 10, null, null, null, null, null, null, "completedInvolved", "SHARED").content()).isEmpty();
    }

    private Emp employee(String name) {
        Emp emp = Emp.pending(name, name, "MALE", null, null, null, null, "Staff", null, null, null, "REGULAR", null, null);
        em.persist(emp);
        return emp;
    }

    private ApprovalDocument document(String status) {
        ApprovalDocument doc = ApprovalDocument.builder().title("reference-fixture").content("fixture")
            .templateCode("DRAFT").templateVersion(1).requester(requester).searchText("reference-fixture").build();
        ReflectionTestUtils.setField(doc, "status", status);
        em.persist(doc);
        return doc;
    }

    private ApprovalLine line(ApprovalDocument doc, Emp assignee, String type) {
        ApprovalLine line = ApprovalLine.builder().document(doc).approver(assignee).lineType(type).lineOrder(1).first(false).build();
        em.persist(line);
        return line;
    }
}
