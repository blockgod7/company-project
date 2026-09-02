package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.kjh.groupware.domain.emp.Emp;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

class ApprovalEquipmentSelfRequestPdfTest {
    @ParameterizedTest
    @ValueSource(strings = {"EQUIPMENT_PROPOSAL", "MOLD_FIXTURE_PROPOSAL"})
    @EnabledOnOs(OS.WINDOWS)
    void integratedApprovalIsPrintedOnceAndPurchaseStampsStaySeparate(String code) throws Exception {
        Emp writer = person(1L, "요청작성자");
        Emp approver = person(2L, "통합승인자");
        Emp purchaser = person(3L, "구매작성자");
        Emp purchaseApprover = person(4L, "구매승인자");
        ApprovalDocument document = ApprovalDocument.builder().requester(writer).templateCode(code).title("자체 요청 검증")
            .formDataJson("{\"fields\":{\"equipmentRequestMode\":\"PE_SELF\"}}").build();
        document.submit("SELF-2026-001", "test", false);
        ApprovalEquipmentProposal proposal = new ApprovalEquipmentProposal(document);
        proposal.updateUserSection("생산기술", "설비 테스트", "2026-09-30", "10 kW", "구매", "현상 검토", "요구 사항", "지시 사항", "사용 경제성");
        proposal.updatePeSection("기술 검토 내용", "설계 검토 내용", "주관 경제성");
        proposal.assignPe(writer);
        proposal.moveToPurchaseInput(purchaser);
        proposal.updatePurchaseSection("구매 검토", "업체", "2026-09-30", "설비 테스트", "시험", "1", "100", "비고", false, false, false, false, "");
        ApprovalLine integrated = line(document, approver, 1);
        ReflectionTestUtils.setField(integrated, "status", ApprovalLine.STATUS_APPROVED);
        ApprovalLine purchaseInput = line(document, purchaser, 3);
        purchaseInput.skip("PURCHASE_INPUT_COMPLETED");
        ApprovalLine purchaseDecision = line(document, purchaseApprover, 4);
        ReflectionTestUtils.setField(purchaseDecision, "status", ApprovalLine.STATUS_APPROVED);
        proposal.complete();
        List<ApprovalLine> lines = List.of(integrated, purchaseInput, purchaseDecision);
        ApprovalEquipmentProposalRepository repository = mock(ApprovalEquipmentProposalRepository.class);
        when(repository.findByApprovalApprovalId(any())).thenReturn(Optional.of(proposal));
        ApprovalEquipmentPdfRenderer renderer = new ApprovalEquipmentPdfRenderer(repository);
        var groups = renderer.equipmentApprovalGroups(lines, proposal);
        assertThat(groups.userLines()).containsExactly(integrated);
        assertThat(groups.peLines()).isEmpty();
        assertThat(groups.purchaseLines()).containsExactly(purchaseDecision);
        ApprovalGeneratedPdf result = renderer.renderEquipmentProposal(document, lines);
        try (var pdf = Loader.loadPDF(result.bytes())) {
            assertThat(pdf.getNumberOfPages()).isEqualTo(1);
            String text = new PDFTextStripper().getText(pdf);
            assertThat(text).contains("생산기술 자체 요청", "요청·주관 통합 결재", "기술 검토 내용", "설계 검토 내용", "구매승인자");
            assertThat(text.split("통합승인자", -1).length - 1).isEqualTo(1);
            assertThat(text.split("구매승인자", -1).length - 1).isEqualTo(1);
        }
        String qaDir = System.getProperty("equipment.pdf.qaDir");
        if (qaDir != null) {
            Path directory = Path.of(qaDir);
            Files.createDirectories(directory);
            Files.write(directory.resolve(code + ".pdf"), result.bytes());
        }
    }

    private Emp person(Long id, String name) {
        Emp emp = mock(Emp.class);
        when(emp.getEmpId()).thenReturn(id);
        when(emp.getEmpName()).thenReturn(name);
        when(emp.getPositionName()).thenReturn("담당");
        return emp;
    }

    private ApprovalLine line(ApprovalDocument document, Emp emp, int order) {
        ApprovalLine line = ApprovalLine.builder().document(document).approver(emp).lineType(ApprovalLine.TYPE_APPROVAL).lineOrder(order).build();
        ReflectionTestUtils.setField(line, "signedAt", LocalDateTime.of(2026, 9, 2, 10, 0));
        return line;
    }
}
