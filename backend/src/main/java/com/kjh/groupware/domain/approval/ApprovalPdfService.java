package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.file.AttachFile;
import com.kjh.groupware.domain.file.FileService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalPdfService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLineRepository lineRepository;
    private final ApprovalPdfHistoryRepository historyRepository;
    private final FileService fileService;
    private final CurrentEmpProvider currentEmpProvider;

    @Transactional
    public void generateForFinalApproval(ApprovalDocument document) {
        if (ApprovalDocument.PDF_STATUS_GENERATING.equals(document.getPdfStatus())) {
            throw BusinessException.badRequest("PDF_ALREADY_GENERATING", "PDF generation is already running");
        }
        document.startPdfGeneration();
        try {
            GeneratedPdf generated = render(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
            AttachFile file = fileService.saveGeneratedFile(
                "APPROVAL_PDF",
                document.getApprovalId(),
                document.getDocumentNo() + ".pdf",
                generated.bytes(),
                "application/pdf",
                document.getRequester()
            );
            document.completePdfGeneration(file, generated.hash());
        } catch (RuntimeException ex) {
            document.failPdfGeneration(ex.getMessage());
        }
    }

    @Transactional
    public ApprovalDocument regenerate(Long approvalId, String reason) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = documentRepository.findById(approvalId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found"));
        if (!ApprovalDocument.STATUS_APPROVED.equals(document.getStatus())) {
            throw BusinessException.badRequest("APPROVAL_NOT_APPROVED", "Only approved documents can regenerate PDFs");
        }
        if (!currentEmp.getEmpId().equals(document.getRequester().getEmpId()) && !"ADMIN".equals(currentEmp.getRoleCode())) {
            throw BusinessException.forbidden("PDF_REGENERATE_FORBIDDEN", "Only the requester or an admin can regenerate PDFs");
        }
        if (ApprovalDocument.PDF_STATUS_GENERATING.equals(document.getPdfStatus())) {
            throw BusinessException.badRequest("PDF_ALREADY_GENERATING", "PDF generation is already running");
        }
        AttachFile oldFile = document.getPdfFile();
        String oldHash = document.getPdfHash();
        document.startPdfGeneration();
        try {
            GeneratedPdf generated = render(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
            AttachFile newFile = fileService.saveGeneratedFile(
                "APPROVAL_PDF",
                document.getApprovalId(),
                document.getDocumentNo() + "-regenerated.pdf",
                generated.bytes(),
                "application/pdf",
                currentEmp
            );
            document.completePdfGeneration(newFile, generated.hash());
            historyRepository.save(ApprovalPdfHistory.builder()
                .approval(document)
                .oldPdfFile(oldFile)
                .newPdfFile(newFile)
                .oldPdfHash(oldHash)
                .newPdfHash(generated.hash())
                .regeneratedBy(currentEmp)
                .reason(reason)
                .build());
        } catch (RuntimeException ex) {
            document.failPdfGeneration(ex.getMessage());
        }
        return document;
    }

    @Transactional(readOnly = true)
    public AttachFile getGeneratedPdf(Long approvalId) {
        ApprovalDocument document = documentRepository.findById(approvalId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found"));
        if (ApprovalDocument.PDF_STATUS_GENERATING.equals(document.getPdfStatus())) {
            throw BusinessException.badRequest("PDF_GENERATING", "PDF is still being generated");
        }
        if (ApprovalDocument.PDF_STATUS_FAILED.equals(document.getPdfStatus())) {
            throw BusinessException.badRequest("PDF_FAILED", document.getPdfErrorMessage());
        }
        if (!ApprovalDocument.PDF_STATUS_GENERATED.equals(document.getPdfStatus()) || document.getPdfFile() == null) {
            throw BusinessException.notFound("PDF_NOT_FOUND", "PDF has not been generated");
        }
        return document.getPdfFile();
    }

    private GeneratedPdf render(ApprovalDocument document, List<ApprovalLine> lines) {
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);
            PDFont font = loadFont(pdf);
            try (PDPageContentStream content = new PDPageContentStream(pdf, page)) {
                drawApprovalStampTable(content, font, document, lines);
                content.beginText();
                content.setFont(font, 16);
                content.setLeading(20);
                content.newLineAtOffset(54, 760);
                writeLine(content, "전자결재 문서");
                content.setFont(font, 10);
                content.setLeading(15);
                writeLine(content, "문서번호: " + safe(document.getDocumentNo()));
                writeLine(content, "제목: " + safe(document.getTitle()));
                writeLine(content, "상태: " + safe(document.getStatus()));
                writeLine(content, "기안자: " + safe(document.getRequester().getEmpName()));
                writeLine(content, "템플릿: " + safe(document.getTemplateCode()) + " v" + safe(document.getTemplateVersion()));
                writeLine(content, "기안일: " + safe(document.getRequestedAt()));
                writeLine(content, "완료일: " + safe(document.getCompletedAt()));
                writeLine(content, "");
                writeLine(content, "[입력 데이터]");
                for (String line : wrap(safe(document.getFormDataJson()), 86)) {
                    writeLine(content, line);
                }
                writeLine(content, "");
                writeLine(content, "[결재선]");
                for (ApprovalLine line : lines) {
                    writeLine(content, line.getLineOrder() + ". " + line.getApprover().getEmpName() + " / " + line.getStatus()
                        + " / signedAt=" + safe(line.getSignedAt()) + " / signature=" + safe(line.getSignatureSnapshotJson()));
                }
                writeLine(content, "");
                writeLine(content, "[템플릿 스냅샷]");
                for (String line : wrap(safe(document.getTemplateSnapshotJson()), 86)) {
                    writeLine(content, line);
                }
                content.endText();
            }
            pdf.save(output);
            byte[] bytes = output.toByteArray();
            return new GeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate PDF");
        }
    }

    private PDFont loadFont(PDDocument pdf) throws IOException {
        for (String path : List.of("C:/Windows/Fonts/malgun.ttf", "C:/Windows/Fonts/malgunsl.ttf")) {
            if (Files.exists(Path.of(path))) {
                return PDType0Font.load(pdf, Path.of(path).toFile());
            }
        }
        return new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    }

    private List<String> wrap(String text, int width) {
        if (text == null || text.isBlank()) {
            return List.of("-");
        }
        return text.lines()
            .flatMap(line -> {
                if (line.length() <= width) {
                    return java.util.stream.Stream.of(line);
                }
                java.util.ArrayList<String> parts = new java.util.ArrayList<>();
                for (int i = 0; i < line.length(); i += width) {
                    parts.add(line.substring(i, Math.min(i + width, line.length())));
                }
                return parts.stream();
            })
            .limit(28)
            .toList();
    }

    private void writeLine(PDPageContentStream content, String text) throws IOException {
        content.showText(safe(text));
        content.newLine();
    }

    private void drawApprovalStampTable(PDPageContentStream content, PDFont font, ApprovalDocument document, List<ApprovalLine> lines) throws IOException {
        int approvalColumns = lines.size() + 1;
        float labelWidth = 22;
        float colWidth = Math.max(42, Math.min(58, 245f / Math.max(approvalColumns, 1)));
        float positionHeight = 22;
        float signatureHeight = 64;
        float dateHeight = 22;
        float tableHeight = positionHeight + signatureHeight + dateHeight;
        float tableWidth = labelWidth + colWidth * approvalColumns;
        float x = 540 - tableWidth;
        float y = 780 - tableHeight;

        content.setLineWidth(0.7f);
        content.addRect(x, y, labelWidth, tableHeight);
        content.stroke();
        drawCenteredText(content, font, "결재", x, y + tableHeight / 2 - 5, labelWidth, 10, 9);

        float startX = x + labelWidth;
        drawApprovalColumn(content, font, startX, y, colWidth, document.getRequester().getPositionName(), document.getRequester().getEmpName(), dateText(document.getRequestedAt()));
        for (int index = 0; index < lines.size(); index++) {
            ApprovalLine line = lines.get(index);
            boolean signed = ApprovalLine.STATUS_APPROVED.equals(line.getStatus()) || ApprovalLine.STATUS_REJECTED.equals(line.getStatus());
            String signature = signed ? signatureDisplayName(line) : "";
            String date = signed ? dateText(line.getSignedAt() == null ? line.getActedAt() : line.getSignedAt()) : "";
            drawApprovalColumn(
                content,
                font,
                startX + colWidth * (index + 1),
                y,
                colWidth,
                line.getApprover().getPositionName(),
                signature,
                date
            );
        }
    }

    private void drawApprovalColumn(PDPageContentStream content, PDFont font, float x, float y, float width, String position, String signature, String date) throws IOException {
        float dateHeight = 22;
        float signatureHeight = 64;
        float positionHeight = 22;
        content.addRect(x, y + dateHeight + signatureHeight, width, positionHeight);
        content.addRect(x, y + dateHeight, width, signatureHeight);
        content.addRect(x, y, width, dateHeight);
        content.stroke();
        drawCenteredText(content, font, safe(position), x, y + dateHeight + signatureHeight + 7, width, 9, 8);
        drawCenteredText(content, font, safe(signature), x, y + dateHeight + 27, width, 12, 11);
        drawCenteredText(content, font, safe(date), x, y + 7, width, 8, 7);
    }

    private void drawCenteredText(PDPageContentStream content, PDFont font, String text, float x, float y, float width, float fontSize, int maxChars) throws IOException {
        String value = text == null ? "" : text;
        if (value.length() > maxChars) {
            value = value.substring(0, maxChars);
        }
        float textWidth = font.getStringWidth(value) / 1000 * fontSize;
        content.beginText();
        content.setFont(font, fontSize);
        content.newLineAtOffset(x + Math.max(2, (width - textWidth) / 2), y);
        content.showText(value);
        content.endText();
    }

    private String signatureDisplayName(ApprovalLine line) {
        String snapshot = line.getSignatureSnapshotJson();
        if (snapshot != null) {
            String marker = "\"displayName\":\"";
            int start = snapshot.indexOf(marker);
            if (start >= 0) {
                int valueStart = start + marker.length();
                int valueEnd = snapshot.indexOf("\"", valueStart);
                if (valueEnd > valueStart) {
                    return snapshot.substring(valueStart, valueEnd);
                }
            }
        }
        return line.getApprover().getEmpName();
    }

    private String dateText(LocalDateTime value) {
        return value == null ? "" : DATE_FORMAT.format(value);
    }

    private String safe(Object value) {
        return value == null ? "-" : String.valueOf(value).replace("\r", " ").replace("\n", " ");
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw BusinessException.badRequest("PDF_HASH_FAILED", "Failed to hash PDF");
        }
    }

    private record GeneratedPdf(byte[] bytes, String hash) {
    }
}
