package com.kjh.groupware.domain.approval;

import static com.kjh.groupware.domain.approval.ApprovalPdfCanvas.*;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.file.AttachFile;
import com.kjh.groupware.domain.file.AttachFileRepository;
import com.kjh.groupware.domain.file.FileService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
class ApprovalStandardPdfRenderer extends ApprovalPdfRenderSupport {

    private final AttachFileRepository attachFileRepository;

    ApprovalGeneratedPdf renderPurchaseRequest(ApprovalDocument document, List<ApprovalLine> lines) {
        JsonNode fields = formFields(document.getFormDataJson());
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);
            PDFont font = loadFont(pdf);
            try (PDPageContentStream content = new PDPageContentStream(pdf, page)) {
                content.setLineWidth(1.0f);
                List<ApprovalLine> receiverLines = linesOfType(lines, ApprovalLine.TYPE_RECEIVER);
                Integer firstReceiverOrder = receiverLines.stream()
                    .map(ApprovalLine::getLineOrder)
                    .min(Comparator.naturalOrder())
                    .orElse(Integer.MAX_VALUE);
                Integer lastReceiverOrder = receiverLines.stream()
                    .map(ApprovalLine::getLineOrder)
                    .max(Comparator.naturalOrder())
                    .orElse(Integer.MIN_VALUE);
                List<ApprovalLine> approvalLines = lines.stream()
                    .filter(ApprovalLine::isApproval)
                    .filter(line -> line.getLineOrder() < firstReceiverOrder)
                    .sorted(Comparator.comparing(ApprovalLine::getLineOrder))
                    .toList();
                List<PdfStampColumn> receiverColumns = new ArrayList<>();
                receiverLines.stream()
                    .map(this::purchaseReceiverStamp)
                    .forEach(receiverColumns::add);
                lines.stream()
                    .filter(line -> line.isAgreement() || line.isApproval())
                    .filter(line -> line.getLineOrder() > lastReceiverOrder)
                    .sorted(Comparator.comparing(ApprovalLine::getLineOrder))
                    .map(this::approvalStamp)
                    .forEach(receiverColumns::add);
                float stampWidth = 180;
                drawDepartmentStamp(content, font, 60, 696, stampWidth, "결재", requesterStamp(document), approvalLines);
                drawCenteredText(content, font, "구매요구서", 240, 728, 116, 17, 20);
                drawDepartmentStampColumns(content, font, 536 - stampWidth, 696, stampWidth, "수신", null, receiverColumns);

                float x = 60;
                float y = 622;
                float width = 476;
                float row = 26;
                drawPurchaseRequestInfoRow(content, font, x, y + row, width, "부서명", purchaseField(fields, "requestDeptName", safe(document.getDraftDeptName())), "성명", purchaseField(fields, "requesterName", document.getRequester().getEmpName()));
                drawPurchaseRequestInfoRow(content, font, x, y, width, "청구일", purchaseField(fields, "requestDate", dateText(document.getRequestedAt())), "요구일", text(fields, "requiredDate"));
                drawPurchaseRequestInfoRow(content, font, x, y - row, width, "접수일", purchaseReceiptDate(lines), "입고일", text(fields, "deliveryDate"));
                drawPurchaseSingleInfoRow(content, font, x, y - row * 2, 70, width - 70, row, "제목", safe(document.getTitle()));

                float tableY = y - row * 2 - 30;
                drawPurchaseItemsTable(content, font, fields, x, tableY, width);
                float buY = tableY - 242;
                drawPurchaseBuTable(content, font, fields, x + 44, buY, width - 88);
                String attachments = attachFileRepository.findByTargetTypeAndTargetIdAndDeletedYnOrderByFileIdAsc("APPROVAL_DOCUMENT", document.getApprovalId(), "N").stream()
                    .map(AttachFile::getOriginalFileName)
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("-");
                drawPurchaseSingleInfoRow(content, font, x, 82, 70, width - 70, 24, "첨부", attachments);
            }
            pdf.save(output);
            byte[] bytes = output.toByteArray();
            return new ApprovalGeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate purchase request PDF");
        }
    }

    private void drawPurchaseRequestInfoRow(PDPageContentStream content, PDFont font, float x, float y, float width, String leftLabel, String leftValue, String rightLabel, String rightValue) throws IOException {
        float half = width / 2f;
        drawPurchaseSingleInfoRow(content, font, x, y, 62, half - 62, 26, leftLabel, safe(leftValue));
        drawPurchaseSingleInfoRow(content, font, x + half, y, 62, half - 62, 26, rightLabel, safe(rightValue));
    }

    private void drawPurchaseSingleInfoRow(PDPageContentStream content, PDFont font, float x, float y, float labelWidth, float valueWidth, float height, String label, String value) throws IOException {
        drawBox(content, x, y, labelWidth, height);
        drawBox(content, x + labelWidth, y, valueWidth, height);
        float fontSize = 8f;
        float textY = y + (height - fontSize) / 2f - 1;
        drawCenteredText(content, font, label, x, textY, labelWidth, fontSize, 12);
        drawFittedText(content, font, safe(value), x + labelWidth + 6, textY, valueWidth - 12, fontSize);
    }

    private void drawPurchaseItemsTable(PDPageContentStream content, PDFont font, JsonNode fields, float x, float y, float width) throws IOException {
        float[] cols = {78, 160, 64, width - 302};
        float rowHeight = 22;
        String[] headers = {"품명", "규격", "수량", "용도"};
        float cx = x;
        for (int i = 0; i < headers.length; i++) {
            drawBox(content, cx, y, cols[i], rowHeight);
            drawCenteredText(content, font, headers[i], cx, y + 7, cols[i], 9, 8);
            cx += cols[i];
        }
        List<String[]> items = purchaseItems(fields);
        for (int rowIndex = 0; rowIndex < 8; rowIndex++) {
            cx = x;
            String[] item = rowIndex < items.size() ? items.get(rowIndex) : new String[] {"", "", "", ""};
            for (int i = 0; i < cols.length; i++) {
                float cy = y - rowHeight * (rowIndex + 1);
                drawBox(content, cx, cy, cols[i], rowHeight);
                drawFittedText(content, font, safe(item[i]), cx + 5, cy + 7, cols[i] - 10, 8);
                cx += cols[i];
            }
        }
    }

    private void drawPurchaseBuTable(PDPageContentStream content, PDFont font, JsonNode fields, float x, float y, float width) throws IOException {
        drawCenteredText(content, font, "BU 비용분할", x, y + 38, width, 10, 12);
        String[] codes = {"BU1", "BU2", "BU3", "BU4", "BU5", "BU7", "BU9", "BU20", "EC", "BU60"};
        float col = width / 5f;
        float rowHeight = 28;
        for (int i = 0; i < codes.length; i++) {
            int row = i / 5;
            int column = i % 5;
            float cx = x + column * col;
            float cy = y - row * rowHeight;
            drawBox(content, cx, cy, col, rowHeight);
            drawCenteredText(content, font, codes[i], cx, cy + 17, col, 8, 8);
            drawCenteredText(content, font, purchaseBuValue(fields, codes[i]), cx, cy + 6, col, 8, 8);
        }
    }

    private List<String[]> purchaseItems(JsonNode fields) {
        List<String[]> items = new ArrayList<>();
        String raw = text(fields, "purchaseItemsJson");
        if (!raw.isBlank()) {
            try {
                JsonNode root = OBJECT_MAPPER.readTree(raw);
                if (root.isArray()) {
                    for (JsonNode node : root) {
                        String[] row = {
                            text(node, "itemName"),
                            text(node, "spec"),
                            text(node, "quantity"),
                            text(node, "usage")
                        };
                        if (java.util.Arrays.stream(row).anyMatch(value -> value != null && !value.isBlank())) {
                            items.add(row);
                        }
                    }
                }
            } catch (IOException ignored) {
                items.clear();
            }
        }
        return items;
    }

    private String purchaseField(JsonNode fields, String name, String fallback) {
        String value = text(fields, name);
        return value.isBlank() ? safe(fallback) : value;
    }

    private String purchaseBuValue(JsonNode fields, String code) {
        String value = text(fields, "bu_" + code);
        return value.isBlank() ? "0%" : value + "%";
    }

    private String purchaseReceiptDate(List<ApprovalLine> lines) {
        return lines.stream()
            .filter(ApprovalLine::isReceiver)
            .filter(line -> line.getReadAt() != null || line.getActedAt() != null)
            .sorted(Comparator.comparing(ApprovalLine::getLineOrder))
            .map(line -> line.getReadAt() == null ? dateText(line.getActedAt()) : dateText(line.getReadAt()))
            .findFirst()
            .orElse("-");
    }

    ApprovalGeneratedPdf renderTrainingRequest(ApprovalDocument document, List<ApprovalLine> lines) {
        JsonNode fields = formFields(document.getFormDataJson());
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);
            PDFont font = loadFont(pdf);
            try (PDPageContentStream content = new PDPageContentStream(pdf, page)) {
                content.setLineWidth(1.0f);
                List<ApprovalLine> receiverLines = linesOfType(lines, ApprovalLine.TYPE_RECEIVER);
                Integer firstReceiverOrder = receiverLines.stream()
                    .map(ApprovalLine::getLineOrder)
                    .min(Comparator.naturalOrder())
                    .orElse(Integer.MAX_VALUE);
                Integer lastReceiverOrder = receiverLines.stream()
                    .map(ApprovalLine::getLineOrder)
                    .max(Comparator.naturalOrder())
                    .orElse(Integer.MIN_VALUE);
                List<ApprovalLine> requestDeptLines = lines.stream()
                    .filter(ApprovalLine::isApproval)
                    .filter(line -> line.getLineOrder() < firstReceiverOrder)
                    .sorted(Comparator.comparing(ApprovalLine::getLineOrder))
                    .toList();
                List<PdfStampColumn> hostDeptColumns = new ArrayList<>();
                receiverLines.stream()
                    .map(this::purchaseReceiverStamp)
                    .forEach(hostDeptColumns::add);
                lines.stream()
                    .filter(line -> line.isAgreement() || line.isApproval())
                    .filter(line -> line.getLineOrder() > lastReceiverOrder)
                    .sorted(Comparator.comparing(ApprovalLine::getLineOrder))
                    .map(this::approvalStamp)
                    .forEach(hostDeptColumns::add);

                float stampWidth = 180;
                drawDepartmentStamp(content, font, 60, 696, stampWidth, "신청부서", requesterStamp(document), requestDeptLines);
                drawCenteredText(content, font, "교육 신청서", 240, 728, 116, 17, 20);
                drawDepartmentStampColumns(content, font, 536 - stampWidth, 696, stampWidth, "주관부서", null, hostDeptColumns);

                float x = 60;
                float width = 476;
                float y = 622;
                drawTrainingPersonRow(content, font, x, y, width, fields, document);
                drawPurchaseSingleInfoRow(content, font, x, y - 42, 70, width - 70, 42, "교육명", text(fields, "trainingName"));
                drawPurchaseSingleInfoRow(content, font, x, y - 84, 70, width - 70, 42, "교육기관", text(fields, "institution"));

                float reasonY = y - 338;
                drawBox(content, x, reasonY, 70, 254);
                drawBox(content, x + 70, reasonY, width - 70, 254);
                drawCenteredText(content, font, "사유", x, reasonY + 124, 70, 9, 6);
                drawCenteredText(content, font, "(구체적)", x, reasonY + 108, 70, 9, 6);
                drawWrappedText(content, font, text(fields, "reason"), x + 80, reasonY + 232, width - 90, 10, 13);

                String requestType = trainingField(fields, "requestType", "수강");
                drawTrainingFooter(content, font, x, 134, width, trainingRequestSubject(fields), requestType, trainingField(fields, "requestDate", dateText(document.getRequestedAt())));
            }
            pdf.save(output);
            byte[] bytes = output.toByteArray();
            return new ApprovalGeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate training request PDF");
        }
    }

    private String trainingField(JsonNode fields, String name, String fallback) {
        String value = text(fields, name);
        return value.isBlank() ? safe(fallback) : value;
    }

    private void drawTrainingPersonRow(PDPageContentStream content, PDFont font, float x, float y, float width, JsonNode fields, ApprovalDocument document) throws IOException {
        float height = 26;
        float deptLabel = 52;
        float deptValue = 200;
        float positionLabel = 50;
        float positionValue = 66;
        float nameLabel = 50;
        float nameValue = width - deptLabel - deptValue - positionLabel - positionValue - nameLabel;
        float cursor = x;
        drawPurchaseSingleInfoRow(content, font, cursor, y, deptLabel, deptValue, height, "소속", trainingField(fields, "deptName", safe(document.getDraftDeptName())));
        cursor += deptLabel + deptValue;
        drawPurchaseSingleInfoRow(content, font, cursor, y, positionLabel, positionValue, height, "직위", text(fields, "positionName"));
        cursor += positionLabel + positionValue;
        drawPurchaseSingleInfoRow(content, font, cursor, y, nameLabel, nameValue, height, "성명", trainingField(fields, "requesterName", document.getRequester().getEmpName()));
    }

    private void drawTrainingFooter(PDPageContentStream content, PDFont font, float x, float y, float width, String subject, String requestType, String requestDate) throws IOException {
        drawCenteredText(content, font, "본인은 상기와 같이", x, y + 54, width, 11, 40);
        float subjectY = y + 36;
        for (String line : wrap(subject + "의", 34).stream().limit(3).toList()) {
            drawCenteredText(content, font, line, x, subjectY, width, 11, 40);
            subjectY -= 16;
        }
        drawCenteredText(content, font, "수강(" + ("수강".equals(requestType) ? "●" : " ") + ")  변경(" + ("변경".equals(requestType) ? "●" : " ") + ")  불참(" + ("불참".equals(requestType) ? "●" : " ") + ") 을 신청합니다.", x, subjectY - 2, width, 11, 40);
        drawCenteredText(content, font, requestDate, x, subjectY - 32, width, 10, 16);
    }

    private String trainingRequestSubject(JsonNode fields) {
        String trainingName = trainingField(fields, "trainingName", "상기").trim();
        return trainingName.endsWith("교육") ? trainingName : trainingName + " 교육";
    }

    ApprovalGeneratedPdf renderTrainingReport(ApprovalDocument document, List<ApprovalLine> lines) {
        JsonNode fields = formFields(document.getFormDataJson());
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);
            PDFont font = loadFont(pdf);
            try (PDPageContentStream content = new PDPageContentStream(pdf, page)) {
                content.setLineWidth(1.0f);
                List<ApprovalLine> receiverLines = linesOfType(lines, ApprovalLine.TYPE_RECEIVER);
                Integer firstReceiverOrder = receiverLines.stream()
                    .map(ApprovalLine::getLineOrder)
                    .min(Comparator.naturalOrder())
                    .orElse(Integer.MAX_VALUE);
                Integer lastReceiverOrder = receiverLines.stream()
                    .map(ApprovalLine::getLineOrder)
                    .max(Comparator.naturalOrder())
                    .orElse(Integer.MIN_VALUE);
                List<ApprovalLine> requestDeptLines = lines.stream()
                    .filter(ApprovalLine::isApproval)
                    .filter(line -> line.getLineOrder() < firstReceiverOrder)
                    .sorted(Comparator.comparing(ApprovalLine::getLineOrder))
                    .toList();
                List<PdfStampColumn> hostDeptColumns = new ArrayList<>();
                receiverLines.stream()
                    .map(this::purchaseReceiverStamp)
                    .forEach(hostDeptColumns::add);
                lines.stream()
                    .filter(line -> line.isAgreement() || line.isApproval())
                    .filter(line -> line.getLineOrder() > lastReceiverOrder)
                    .sorted(Comparator.comparing(ApprovalLine::getLineOrder))
                    .map(this::approvalStamp)
                    .forEach(hostDeptColumns::add);

                float stampWidth = 180;
                drawCenteredText(content, font, "교육 훈련 보고서", 72, 716, 260, 20, 20);
                drawDepartmentStamp(content, font, 356, 696, stampWidth, "결재", requesterStamp(document), requestDeptLines);
                drawDepartmentStampColumns(content, font, 356, 618, stampWidth, "주관부서", null, hostDeptColumns);

                float x = 40;
                float width = 515;
                float y = 612;
                drawTrainingReportMetaRow(content, font, x, y, width, fields, document);
                y -= 28;
                drawPurchaseRequestInfoRow(content, font, x, y, width, "교육명", text(fields, "trainingName"), "교육기관", text(fields, "institution"));
                y -= 28;
                drawPurchaseSingleInfoRow(content, font, x, y, 84, width - 84, 28, "교육기간", text(fields, "trainingPeriod"));
                y -= 116;
                drawTrainingReportTextRow(content, font, x, y, width, 116, "주요교육\n내용", text(fields, "mainContent"), 8);
                y -= 116;
                drawTrainingReportTextRow(content, font, x, y, width, 116, "업무수행\n방안", text(fields, "jobApplication"), 8);
                y -= 116;
                drawTrainingReportTextRow(content, font, x, y, width, 116, "교육\n소감", text(fields, "impression"), 8);
                y -= 64;
                drawTrainingReportTextRow(content, font, x, y, width, 64, "차기에 받고\n싶은 교육\n(업무효과가능)", text(fields, "nextTraining"), 4);
                y -= 64;
                drawTrainingReportBottomRow(content, font, x, y, width, fields);
                drawCenteredText(content, font, "SLQP-6-01-02(2015.05.01)", x, 16, 160, 8, 32);
                drawCenteredText(content, font, "슝크카본테크놀로지 (유)", 210, 16, 180, 8, 24);
                drawCenteredText(content, font, "A4(210X297)", 472, 16, 99, 8, 14);
            }
            pdf.save(output);
            byte[] bytes = output.toByteArray();
            return new ApprovalGeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate training report PDF");
        }
    }

    private void drawTrainingReportMetaRow(PDPageContentStream content, PDFont font, float x, float y, float width, JsonNode fields, ApprovalDocument document) throws IOException {
        float part = width / 3f;
        drawPurchaseSingleInfoRow(content, font, x, y, 58, part - 58, 28, "작성일", trainingField(fields, "reportDate", dateText(document.getRequestedAt())));
        drawPurchaseSingleInfoRow(content, font, x + part, y, 52, part - 52, 28, "사번", trainingField(fields, "empNo", document.getRequester().getEmpNo()));
        drawPurchaseSingleInfoRow(content, font, x + part * 2, y, 52, width - part * 2 - 52, 28, "성명", trainingField(fields, "requesterName", document.getRequester().getEmpName()));
    }

    private void drawTrainingReportTextRow(PDPageContentStream content, PDFont font, float x, float y, float width, float height, String label, String value, int maxLines) throws IOException {
        float labelWidth = 84;
        drawBox(content, x, y, labelWidth, height);
        drawBox(content, x + labelWidth, y, width - labelWidth, height);
        drawWrappedText(content, font, label, x + 8, y + height - 28, labelWidth - 16, 8, 4);
        drawWrappedText(content, font, safe(value), x + labelWidth + 10, y + height - 18, width - labelWidth - 20, 9, maxLines);
    }

    private void drawTrainingReportBottomRow(PDPageContentStream content, PDFont font, float x, float y, float width, JsonNode fields) throws IOException {
        float height = 64;
        float labelWidth = 84;
        float leftWidth = width * 0.66f;
        drawBox(content, x, y, labelWidth, height);
        drawBox(content, x + labelWidth, y, leftWidth - labelWidth, height);
        drawWrappedText(content, font, "유효성 평가\n(시급,속도,균형)", x + 7, y + height - 22, labelWidth - 14, 7, 3);
        drawWrappedText(content, font, text(fields, "effectiveness"), x + labelWidth + 8, y + height - 16, leftWidth - labelWidth - 16, 7, 4);
        drawBox(content, x + leftWidth, y, 64, height);
        drawBox(content, x + leftWidth + 64, y, width - leftWidth - 64, height);
        drawCenteredText(content, font, "총 무", x + leftWidth, y + 28, 64, 8, 5);
        drawWrappedText(content, font, "인사카드기록 확인\n" + text(fields, "hrRecordCheck"), x + leftWidth + 72, y + height - 16, width - leftWidth - 80, 7, 4);
    }

}
