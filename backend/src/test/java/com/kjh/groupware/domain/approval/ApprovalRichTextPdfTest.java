package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.file.AttachFileRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledOnOs;
import org.junit.jupiter.api.condition.OS;

class ApprovalRichTextPdfTest {
    @Test
    void sanitizesUntrustedHtmlAndRetainsOnlySupportedFormatting() {
        String html = ApprovalRichTextPdfBody.safeDocument("""
            <p style="text-align:center;position:fixed;font-size:24px;background-image:url(file:///secret)">
            본문 <strong>굵게</strong><span style="color:rgb(255, 0, 0)">색상</span></p>
            <script>secret</script><iframe src="http://localhost/private">hidden</iframe>
            <img src="http://localhost/private"><a href="javascript:alert(1)">링크</a>
            <table><tr><td colspan="2" rowspan="999999">셀</td></tr></table>
            """).body().html();
        assertThat(html).contains("text-align:center", "font-size:24px", "<strong>굵게</strong>", "colspan=\"2\"");
        assertThat(html).doesNotContain("script", "iframe", "secret", "hidden", "<img", "javascript:", "url(", "position:", "rowspan");
    }

    @Test
    void keepsPlainTextAndEntities() {
        assertThat(ApprovalRichTextPdfBody.safeDocument("첫 줄\n둘째 <값> & 내용").body().html())
            .isEqualTo("<p>첫 줄</p><p>둘째 &lt;값&gt; &amp; 내용</p>");
        assertThat(ApprovalRichTextPdfBody.safeDocument("<p>&#xAC00; &amp; &#39;</p>").body().text()).isEqualTo("가 & '");
    }

    @Test
    @EnabledOnOs(OS.WINDOWS)
    void pdfRetainsSizeAlignmentTablesAllPagesAndApprovalInformation() throws Exception {
        String rows = java.util.stream.IntStream.rangeClosed(1, 45)
            .mapToObj(index -> "<tr><td>품목 " + index + "</td><td>" + index + "개</td></tr>").collect(java.util.stream.Collectors.joining());
        String body = """
            <p><span style="font-size:24px;color:rgb(255, 0, 0)"><strong>Large sample 큰 글자</strong></span></p>
            <p style="text-align:center"><u>Center sample 가운데 정렬</u></p>
            <p style="text-align:right"><mark>Right sample 오른쪽 정렬</mark></p>
            <table><thead><tr><th>품명</th><th>수량</th></tr></thead><tbody>
            """ + rows + """
            </tbody></table><p data-indent="1" style="margin-left:2em"><em>마지막 본문 끝 END-OF-CONTENT</em></p>
            """;
        Emp requester = mock(Emp.class);
        when(requester.getEmpName()).thenReturn("기안자");
        when(requester.getPositionName()).thenReturn("담당");
        ApprovalDocument document = mock(ApprovalDocument.class);
        when(document.getApprovalId()).thenReturn(1L);
        when(document.getTemplateCode()).thenReturn("DRAFT");
        when(document.getDocumentNo()).thenReturn("TEST-DRAFT-001");
        when(document.getTitle()).thenReturn("서식 및 결재정보 검증");
        when(document.getContent()).thenReturn(body);
        when(document.getRequester()).thenReturn(requester);
        when(document.getDraftDeptName()).thenReturn("검증부서");
        when(document.getRequestedAt()).thenReturn(LocalDateTime.of(2026, 9, 2, 9, 0));
        Emp approver = mock(Emp.class);
        when(approver.getEmpName()).thenReturn("결재자");
        when(approver.getPositionName()).thenReturn("팀장");
        ApprovalLine approval = mock(ApprovalLine.class);
        when(approval.getLineType()).thenReturn(ApprovalLine.TYPE_APPROVAL);
        when(approval.getLineOrder()).thenReturn(1);
        when(approval.getApprover()).thenReturn(approver);
        when(approval.getStatus()).thenReturn(ApprovalLine.STATUS_APPROVED);
        when(approval.getSignedAt()).thenReturn(LocalDateTime.of(2026, 9, 2, 10, 0));
        ApprovalPdfRenderer renderer = new ApprovalPdfRenderer(mock(ApprovalStandardPdfRenderer.class),
            mock(ApprovalEquipmentPdfRenderer.class), mock(AttachFileRepository.class));
        ApprovalGeneratedPdf result = renderer.render(document, List.of(approval));
        try (PDDocument pdf = Loader.loadPDF(result.bytes())) {
            assertThat(pdf.getNumberOfPages()).isGreaterThan(1);
            PositionStripper stripper = new PositionStripper();
            String text = stripper.getText(pdf);
            assertThat(text).contains("Large sample", "Center sample", "Right sample", "품목 45", "END-OF-CONTENT",
                "TEST-DRAFT-001", "결재자", "승인", "기안자");
            assertThat(stripper.positions).anySatisfy(position -> {
                assertThat(position.getUnicode()).isEqualTo("L");
                assertThat(position.getFontSizeInPt()).isBetween(17.9f, 18.1f);
                assertThat(position.getXDirAdj()).isBetween(71f, 74f);
            });
            assertThat(stripper.positions).anySatisfy(position -> {
                assertThat(position.getUnicode()).isEqualTo("C");
                assertThat(position.getXDirAdj()).isGreaterThan(150f);
            });
            assertThat(stripper.positions).anySatisfy(position -> {
                assertThat(position.getUnicode()).isEqualTo("R");
                assertThat(position.getXDirAdj()).isGreaterThan(300f);
            });
        }
        if (Boolean.getBoolean("richTextPdfPreview")) {
            Path output = Path.of("..", "tmp", "pdfs", "rich-text-draft.pdf");
            Files.createDirectories(output.getParent());
            Files.write(output, result.bytes());
        }
    }

    private static class PositionStripper extends PDFTextStripper {
        final List<TextPosition> positions = new ArrayList<>();
        PositionStripper() throws IOException { super(); }
        @Override protected void processTextPosition(TextPosition text) {
            positions.add(text);
            super.processTextPosition(text);
        }
    }
}
