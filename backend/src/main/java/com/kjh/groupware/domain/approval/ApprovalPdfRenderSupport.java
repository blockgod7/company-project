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

abstract class ApprovalPdfRenderSupport {

    protected static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    protected static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    protected void drawDepartmentStamp(PDPageContentStream content, PDFont font, float x, float y, float width, String label, PdfStampColumn writer, List<ApprovalLine> approvalLines) throws IOException {
        List<PdfStampColumn> approvalColumns = approvalLines.stream()
            .map(this::approvalStamp)
            .toList();
        if (writer != null && writer.line() != null && ApprovalLine.STATUS_SKIPPED.equals(writer.line().getStatus())) {
            Long writerEmpId = approvalLinePersonId(writer.line());
            ApprovalLine directApproval = approvalLines.stream()
                .filter(line -> writerEmpId != null && writerEmpId.equals(approvalLinePersonId(line)))
                .findFirst()
                .orElse(null);
            if (directApproval != null) {
                writer = approvalStamp(directApproval);
                approvalColumns = approvalLines.stream()
                    .filter(line -> line != directApproval)
                    .map(this::approvalStamp)
                    .toList();
            }
        }
        drawDepartmentStampColumns(content, font, x, y, width, label, writer, approvalColumns);
    }

    protected void drawDepartmentStampColumns(PDPageContentStream content, PDFont font, float x, float y, float width, String label, PdfStampColumn writer, List<PdfStampColumn> approvalColumns) throws IOException {
        drawBox(content, x, y, width, 72);
        float labelWidth = Math.max(30, Math.min(38, width * 0.18f));
        drawVerticalText(content, font, label, x, y + 52, labelWidth, 8);
        List<PdfStampColumn> columns = new ArrayList<>();
        boolean hasWriter = writer != null;
        if (hasWriter) {
            columns.add(writer);
        }
        columns.addAll(approvalColumns);
        int columnCount = hasWriter ? Math.max(2, columns.size()) : Math.max(1, columns.size());
        while (columns.size() < columnCount) {
            columns.add(PdfStampColumn.empty());
        }
        float colWidth = (width - labelWidth) / columnCount;
        for (int i = 0; i < columnCount; i++) {
            float cx = x + labelWidth + colWidth * i;
            drawBox(content, cx, y + 48, colWidth, 24);
            drawBox(content, cx, y, colWidth, 48);
            drawCenteredText(content, font, hasWriter ? stampHeader(i, columnCount) : label, cx, y + 57, colWidth, 8, 4);
            PdfStampColumn column = columns.get(i);
            drawCenteredText(content, font, column.position(), cx, y + 34, colWidth, 7, 9);
            drawCenteredText(content, font, column.name(), cx, y + 21, colWidth, 9, 8);
            drawCenteredText(content, font, column.date(), cx, y + 8, colWidth, 6, 10);
        }
    }

    protected String stampHeader(int index, int columnCount) {
        if (index == 0) {
            return "작성";
        }
        return index == columnCount - 1 ? "승인" : "검토";
    }

    protected String text(JsonNode node, String fieldName) {
        if (node == null || node.isMissingNode() || node.isNull()) {
            return "";
        }
        JsonNode value = node.get(fieldName);
        return value == null || value.isNull() ? "" : value.asText("");
    }

    protected JsonNode formFields(String formDataJson) {
        if (formDataJson == null || formDataJson.isBlank()) {
            return OBJECT_MAPPER.createObjectNode();
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(formDataJson);
            JsonNode fields = root.path("fields");
            return fields.isObject() ? fields : root;
        } catch (IOException ignored) {
            return OBJECT_MAPPER.createObjectNode();
        }
    }

    protected String leaveRangeText(JsonNode fields) {
        String startDate = text(fields, "startDate");
        String endDate = text(fields, "endDate");
        String days = dayText(text(fields, "days"));
        if (startDate.isBlank() && endDate.isBlank()) {
            return "- [ " + days + " ]";
        }
        String start = startDate.isBlank() ? endDate : startDate;
        String end = endDate.isBlank() ? startDate : endDate;
        return start + " ~ " + end + " [ " + days + " ]";
    }

    protected String leaveAnnualTotalText(JsonNode fields) {
        String used = text(fields, "usedAnnualDays");
        String total = text(fields, "totalAnnualDays");
        return dayNumber(used) + " / " + (total.isBlank() ? "22" : dayNumber(total)) + " 일";
    }

    protected String leaveRemainingAnnualText(JsonNode fields) {
        String remaining = text(fields, "remainingAnnualDays");
        if (!remaining.isBlank()) {
            return remaining;
        }
        try {
            double total = Double.parseDouble(text(fields, "totalAnnualDays").isBlank() ? "22" : text(fields, "totalAnnualDays"));
            double used = Double.parseDouble(text(fields, "usedAnnualDays").isBlank() ? "0" : text(fields, "usedAnnualDays"));
            double days = Double.parseDouble(text(fields, "days").isBlank() ? "0" : text(fields, "days"));
            return String.valueOf(total - used - days);
        } catch (NumberFormatException ex) {
            return "0";
        }
    }

    protected String dayText(String value) {
        return dayNumber(value) + " 일";
    }

    protected String dayNumber(String value) {
        if (value == null || value.isBlank()) {
            return "0";
        }
        try {
            double parsed = Double.parseDouble(value);
            if (parsed == Math.rint(parsed)) {
                return String.valueOf((long) parsed);
            }
            return String.valueOf(parsed);
        } catch (NumberFormatException ex) {
            return value;
        }
    }

    protected void drawMoldAttachmentChecklist(PDPageContentStream content, PDFont font, float x, float y, float width, ApprovalEquipmentProposal proposal) throws IOException {
        drawBox(content, x, y, width, 24);
        drawText(content, font, "첨부 :", x + 8, y + 8, 8);
        drawText(content, font, checkboxLabel(proposal.getAttachmentContractYn(), "분말금형기초자료"), x + 42, y + 8, 8);
        drawText(content, font, checkboxLabel(proposal.getAttachmentQuoteYn(), "제품도면"), x + 150, y + 8, 8);
        drawText(content, font, checkboxLabel(proposal.getAttachmentDrawingYn(), "부품도면"), x + 222, y + 8, 8);
        drawText(content, font, checkboxLabel(proposal.getAttachmentSpecYn(), "기타"), x + 294, y + 8, 8);
        drawText(content, font, "( " + safe(proposal.getAttachmentEtc()) + " )", x + 332, y + 8, 8);
    }

    protected void drawMoldPurchaseBox(PDPageContentStream content, PDFont font, ApprovalEquipmentProposal proposal, float x, float y, float w) throws IOException {
        float row = 14;
        float noteHeight = 56;
        drawBox(content, x, y, w, row * 4 + noteHeight + 22);
        float half = w / 2f;
        float labelWidth = 74;
        float mainY = y + noteHeight + 22;
        drawPurchaseInfoRow(content, font, x, mainY + row * 2, labelWidth, half - labelWidth, row, "제작업체", safe(proposal.getVendorName()));
        drawPurchaseInfoRow(content, font, x + half, mainY + row * 2, labelWidth, half - labelWidth, row, "납기(예정일)", safe(proposal.getDeliveryDueDate()));
        drawPurchaseInfoRow(content, font, x, mainY + row, labelWidth, half - labelWidth, row, "제품(기종)명", safe(blankToDash(proposal.getPurchaseItemName(), proposal.getProductName())));
        drawPurchaseInfoRow(content, font, x + half, mainY + row, labelWidth, half - labelWidth, row, "제작수량", safe(proposal.getQuantity()));
        drawPurchaseInfoRow(content, font, x, mainY, labelWidth, half - labelWidth, row, "CAVITY", safe(proposal.getCavity()));
        drawPurchaseInfoRow(content, font, x + half, mainY, labelWidth, half - labelWidth, row, "가격", safe(proposal.getPrice()));
        drawBox(content, x, y + 22, w, noteHeight);
        drawText(content, font, "제작사양", x + 8, y + noteHeight + 8, 8);
        drawWrappedText(content, font, safe(proposal.getPurchaseNote()), x + 8, y + noteHeight - 8, w - 16, 7, 4);
        drawBox(content, x, y, half + 100, 22);
        drawBox(content, x + half + 100, y, w - half - 100, 22);
        drawText(content, font, "첨부 :", x + 8, y + 8, 7);
        drawText(content, font, "[ ] 부품도면, [ ] 제품도면, [ ] 견적서, [ ] 기타 ( " + safe(proposal.getAttachmentEtc()) + " )", x + 40, y + 8, 7);
        drawText(content, font, "경유·협조 :", x + half + 112, y + 8, 8);
    }

    protected String blankToDash(String value, String fallback) {
        if (value != null && !value.isBlank()) {
            return value;
        }
        return fallback == null || fallback.isBlank() ? "-" : fallback;
    }

    protected void drawEquipmentTypeBox(PDPageContentStream content, PDFont font, float x, float y, float width, float height, String selectedType) throws IOException {
        float labelWidth = 36;
        drawBox(content, x, y, width, height);
        drawCenteredText(content, font, "구", x, y + 31, labelWidth, 9, 2);
        drawCenteredText(content, font, "분", x, y + 12, labelWidth, 9, 2);
        drawText(content, font, checkboxLabel(selectedType, "구입"), x + labelWidth + 6, y + 29, 7);
        drawText(content, font, checkboxLabel(selectedType, "제작"), x + labelWidth + 58, y + 29, 7);
        drawText(content, font, checkboxLabel(selectedType, "개선"), x + labelWidth + 110, y + 29, 7);
        drawText(content, font, checkboxLabel(selectedType, "수리"), x + labelWidth + 6, y + 9, 7);
        drawText(content, font, checkboxLabel(selectedType, "매각"), x + labelWidth + 58, y + 9, 7);
        drawText(content, font, checkboxLabel(selectedType, "폐기"), x + labelWidth + 110, y + 9, 7);
    }

    protected void drawLabeledBox(PDPageContentStream content, PDFont font, float x, float y, float width, float height, String label, String value, int maxLines) throws IOException {
        drawBox(content, x, y, width, height);
        drawText(content, font, label, x + 8, y + height - 15, 10);
        content.setLineWidth(0.7f);
        content.moveTo(x + 8, y + height - 20);
        content.lineTo(x + Math.min(width - 8, 100), y + height - 20);
        content.stroke();
        content.setLineWidth(1.0f);
        drawWrappedText(content, font, safe(value), x + 8, y + height - 32, width - 16, 8, maxLines);
    }

    protected void drawEconomicReviewBox(PDPageContentStream content, PDFont font, float x, float y, float width, float height, ApprovalEquipmentProposal proposal) throws IOException {
        float headerHeight = 20;
        float half = width / 2f;
        drawBox(content, x, y, width, height);
        drawBox(content, x, y + height - headerHeight, width, headerHeight);
        drawCenteredText(content, font, "경제성 검토", x, y + height - 14, width, 10, 12);
        drawBox(content, x, y, half, height - headerHeight);
        drawBox(content, x + half, y, half, height - headerHeight);
        drawText(content, font, "사용부서", x + 12, y + height - headerHeight - 16, 9);
        drawText(content, font, "주관 부서", x + half + 12, y + height - headerHeight - 16, 9);
        drawWrappedText(content, font, safe(proposal.getUserEconomicReview()), x + 12, y + height - headerHeight - 32, half - 24, 8, 3);
        drawWrappedText(content, font, safe(proposal.getPeEconomicReview()), x + half + 12, y + height - headerHeight - 32, half - 24, 8, 3);
    }

    protected void drawAttachmentChecklist(PDPageContentStream content, PDFont font, float x, float y, float width, ApprovalEquipmentProposal proposal) throws IOException {
        float labelWidth = 72;
        drawBox(content, x, y, width, 40);
        drawBox(content, x, y, labelWidth, 40);
        drawCenteredText(content, font, "첨 부", x, y + 14, labelWidth, 9, 4);
        float tx = x + labelWidth + 18;
        drawText(content, font, checkboxLabel(proposal.getAttachmentContractYn(), "계약서"), tx, y + 24, 8);
        drawText(content, font, checkboxLabel(proposal.getAttachmentQuoteYn(), "견적서"), tx + 64, y + 24, 8);
        drawText(content, font, checkboxLabel(proposal.getAttachmentDrawingYn(), "도면"), tx + 128, y + 24, 8);
        drawText(content, font, checkboxLabel(proposal.getAttachmentSpecYn(), "설비사양서"), tx + 190, y + 24, 8);
        drawText(content, font, "□ 기타 ( " + safe(proposal.getAttachmentEtc()) + " )", tx, y + 8, 8);
    }

    protected void drawPurchaseBox(PDPageContentStream content, PDFont font, ApprovalEquipmentProposal proposal, float x, float y, float w) throws IOException {
        float row = 13.5f;
        float attachmentRow = 22;
        float mainY = y + attachmentRow;
        drawBox(content, x, y, w, row * 4 + attachmentRow);
        float half = w / 2f;
        float labelWidth = 84;
        drawPurchaseInfoRow(content, font, x, mainY + row * 3, labelWidth, half - labelWidth, row, "제작업체", safe(proposal.getVendorName()));
        drawPurchaseInfoRow(content, font, x + half, mainY + row * 3, labelWidth, half - labelWidth, row, "납기(완료예정일)", safe(proposal.getDeliveryDueDate()));
        drawPurchaseInfoRow(content, font, x, mainY + row * 2, labelWidth, half - labelWidth, row, "설비/부품명", safe(proposal.getPurchaseItemName()));
        drawPurchaseInfoRow(content, font, x + half, mainY + row * 2, labelWidth, half - labelWidth, row, "용 도", safe(proposal.getPurchaseUsage()));
        drawPurchaseInfoRow(content, font, x, mainY + row, labelWidth, half - labelWidth, row, "수 량", safe(proposal.getQuantity()));
        drawPurchaseInfoRow(content, font, x, mainY, labelWidth, half - labelWidth, row, "가 격", safe(proposal.getPrice()));
        drawBox(content, x + half, mainY, labelWidth, row * 2);
        drawBox(content, x + half + labelWidth, mainY, half - labelWidth, row * 2);
        drawCenteredText(content, font, "비고", x + half, mainY + row - 3, labelWidth, 8, 4);
        drawWrappedText(content, font, safe(proposal.getPurchaseNote()), x + half + labelWidth + 6, mainY + row * 2 - 11, half - labelWidth - 12, 7, 2);

        drawBox(content, x, y, half, attachmentRow);
        drawBox(content, x + half, y, half, attachmentRow);
        drawText(content, font, "첨부:", x + 8, y + 13, 7);
        drawText(content, font, "[ ] 계약서   [ ] 견적서   [ ] 도면   [ ] 설비사양서", x + 40, y + 13, 7);
        drawText(content, font, "[ ] 기타 ( " + safe(proposal.getAttachmentEtc()) + " )", x + 40, y + 4, 7);
        drawText(content, font, "경유, 협조 :", x + half + 8, y + 8, 8);
        drawText(content, font, "(사용부서)", x + half + 120, y + 8, 6);
        drawText(content, font, "(주관부서)", x + w - 74, y + 8, 6);
    }

    protected void drawPurchaseInfoRow(PDPageContentStream content, PDFont font, float x, float y, float labelWidth, float valueWidth, float height, String label, String value) throws IOException {
        drawBox(content, x, y, labelWidth, height);
        drawBox(content, x + labelWidth, y, valueWidth, height);
        drawCenteredText(content, font, label, x, y + height / 2 - 3, labelWidth, 8, 12);
        drawFittedText(content, font, value, x + labelWidth + 6, y + height / 2 - 3, valueWidth - 12, 7);
    }

    protected String equipmentAttachmentText(ApprovalEquipmentProposal proposal) {
        java.util.ArrayList<String> labels = new java.util.ArrayList<>();
        if ("Y".equals(proposal.getAttachmentContractYn())) labels.add("계약서");
        if ("Y".equals(proposal.getAttachmentQuoteYn())) labels.add("견적서");
        if ("Y".equals(proposal.getAttachmentDrawingYn())) labels.add("도면");
        if ("Y".equals(proposal.getAttachmentSpecYn())) labels.add("설비사양서");
        if (proposal.getAttachmentEtc() != null && !proposal.getAttachmentEtc().isBlank()) labels.add("기타(" + proposal.getAttachmentEtc() + ")");
        return labels.isEmpty() ? "-" : String.join(", ", labels);
    }

    protected EquipmentApprovalGroups equipmentApprovalGroups(List<ApprovalLine> lines, ApprovalEquipmentProposal proposal) {
        List<ApprovalLine> approvals = lines.stream()
            .filter(ApprovalLine::isApproval)
            .sorted(Comparator.comparing(ApprovalLine::getLineOrder))
            .toList();
        ApprovalLine peInputLine = approvals.stream()
            .filter(line -> "PE_INPUT_COMPLETED".equals(line.getComment()))
            .findFirst()
            .orElseGet(() -> ApprovalEquipmentProposal.STAGE_PE_INPUT.equals(proposal.getWorkflowStage())
                ? approvals.stream()
                    .filter(line -> ApprovalLine.STATUS_PENDING.equals(line.getStatus()))
                    .filter(line -> sameEmp(line, proposal.getPeAssignee()))
                    .findFirst()
                    .orElse(null)
                : null);
        ApprovalLine purchaseInputLine = approvals.stream()
            .filter(line -> "PURCHASE_INPUT_COMPLETED".equals(line.getComment()))
            .findFirst()
            .orElseGet(() -> ApprovalEquipmentProposal.STAGE_PURCHASE_INPUT.equals(proposal.getWorkflowStage())
                ? approvals.stream()
                    .filter(line -> ApprovalLine.STATUS_PENDING.equals(line.getStatus()))
                    .filter(line -> sameEmp(line, proposal.getPurchaseAssignee()))
                    .findFirst()
                    .orElse(null)
                : null);
        Integer peInputOrder = peInputLine == null ? null : peInputLine.getLineOrder();
        Integer purchaseInputOrder = purchaseInputLine == null ? null : purchaseInputLine.getLineOrder();
        List<ApprovalLine> realApprovals = approvals.stream()
            .filter(line -> !ApprovalLine.STATUS_SKIPPED.equals(line.getStatus()))
            .toList();
        return new EquipmentApprovalGroups(
            realApprovals.stream()
                .filter(line -> peInputOrder == null || line.getLineOrder() < peInputOrder)
                .toList(),
            peInputLine,
            peInputOrder == null ? List.of() : realApprovals.stream()
                .filter(line -> line.getLineOrder() > peInputOrder)
                .filter(line -> purchaseInputOrder == null || line.getLineOrder() < purchaseInputOrder)
                .toList(),
            purchaseInputLine,
            purchaseInputOrder == null ? List.of() : realApprovals.stream()
                .filter(line -> line.getLineOrder() > purchaseInputOrder)
                .toList()
        );
    }

    protected boolean sameEmp(ApprovalLine line, Emp emp) {
        Long lineEmpId = approvalLinePersonId(line);
        return lineEmpId != null && emp != null && lineEmpId.equals(emp.getEmpId());
    }

    protected Long approvalLinePersonId(ApprovalLine line) {
        if (line.getAssignedEmp() != null) {
            return line.getAssignedEmp().getEmpId();
        }
        return line.getApprover() == null ? null : line.getApprover().getEmpId();
    }

    protected PdfStampColumn requesterStamp(ApprovalDocument document) {
        Emp requester = document.getRequester();
        return new PdfStampColumn(
            safe(requester.getPositionName()),
            safe(requester.getEmpName()),
            dateText(document.getRequestedAt()),
            null
        );
    }

    protected PdfStampColumn sectionLeadStamp(Emp assignee, ApprovalLine leadLine) {
        if (leadLine != null) {
            return new PdfStampColumn(
                safe(leadLine.getPositionSnapshot() == null ? leadLine.getApprover().getPositionName() : leadLine.getPositionSnapshot()),
                safe(leadLine.getEmpNameSnapshot() == null ? leadLine.getApprover().getEmpName() : leadLine.getEmpNameSnapshot()),
                dateText(leadLine.getSignedAt() == null ? leadLine.getActedAt() : leadLine.getSignedAt()),
                leadLine
            );
        }
        if (assignee == null) {
            return PdfStampColumn.empty();
        }
        return new PdfStampColumn(safe(assignee.getPositionName()), safe(assignee.getEmpName()), "", null);
    }

    protected PdfStampColumn approvalStamp(ApprovalLine line) {
        boolean signed = ApprovalLine.STATUS_APPROVED.equals(line.getStatus()) || ApprovalLine.STATUS_REJECTED.equals(line.getStatus());
        return new PdfStampColumn(
            safe(line.getPositionSnapshot() == null ? line.getApprover().getPositionName() : line.getPositionSnapshot()),
            signed ? safe(signatureDisplayName(line)) : "",
            signed ? dateText(line.getSignedAt() == null ? line.getActedAt() : line.getSignedAt()) : "",
            line
        );
    }

    protected PdfStampColumn purchaseReceiverStamp(ApprovalLine line) {
        return new PdfStampColumn(
            safe(line.getPositionSnapshot() == null ? line.getApprover().getPositionName() : line.getPositionSnapshot()),
            safe(line.getEmpNameSnapshot() == null ? line.getApprover().getEmpName() : line.getEmpNameSnapshot()),
            dateText(line.getReadAt() == null ? line.getActedAt() : line.getReadAt()),
            line
        );
    }

    protected void drawClassicLogo(PDDocument pdf, PDPageContentStream content) throws IOException {
        Path logoPath = Path.of("..", "frontend", "src", "assets", "schunk-carbon-logo.png").toAbsolutePath().normalize();
        if (Files.exists(logoPath)) {
            PDImageXObject logo = PDImageXObject.createFromFileByContent(logoPath.toFile(), pdf);
            content.drawImage(logo, 68, 705, 148, 78);
            return;
        }
        drawBox(content, 68, 720, 148, 48);
    }

    protected void drawClassicDraftInfo(PDPageContentStream content, PDFont font, ApprovalDocument document, List<ApprovalLine> lines) throws IOException {
        float x = 62;
        float y = 526;
        float labelWidth = 82;
        float valueWidth = 236;
        float rowHeight = 34;
        drawInfoRow(content, font, x, y + rowHeight * 4, labelWidth, valueWidth, rowHeight, "문서번호", safe(document.getDocumentNo()));
        drawInfoRow(content, font, x, y + rowHeight * 3, labelWidth, valueWidth, rowHeight, "기안부서(자)", safe(document.getDraftDeptName()) + " / " + safe(document.getRequester().getEmpName()));
        drawInfoRow(content, font, x, y + rowHeight * 2, labelWidth, valueWidth, rowHeight, "기안일자", dateText(document.getRequestedAt()));
        drawInfoRow(content, font, x, y + rowHeight, labelWidth, valueWidth, rowHeight, "경유 / 협조", lineSummary(lines, ApprovalLine.TYPE_AGREEMENT));
        drawInfoRow(content, font, x, y, labelWidth, valueWidth, rowHeight, "제목", safe(document.getTitle()));
    }

    protected void drawInfoRow(PDPageContentStream content, PDFont font, float x, float y, float labelWidth, float valueWidth, float height, String label, String value) throws IOException {
        drawBox(content, x, y, labelWidth, height);
        drawBox(content, x + labelWidth, y, valueWidth, height);
        float fontSize = 7f;
        float textY = y + (height - fontSize) / 2f - 1;
        drawCenteredText(content, font, label, x, textY, labelWidth, fontSize, 12);
        drawFittedText(content, font, value, x + labelWidth + 6, textY, valueWidth - 12, fontSize);
    }

    protected void drawLeaveTextRow(PDPageContentStream content, PDFont font, float x, float y, float labelWidth, float valueWidth, float height, String label, String value) throws IOException {
        drawLeaveTextRow(content, font, x, y, labelWidth, valueWidth, height, label, value, 9, 4);
    }

    protected void drawLeaveTextRow(PDPageContentStream content, PDFont font, float x, float y, float labelWidth, float valueWidth, float height, String label, String value, float fontSize, int maxLines) throws IOException {
        drawBox(content, x, y, labelWidth, height);
        drawBox(content, x + labelWidth, y, valueWidth, height);
        drawCenteredText(content, font, label, x, y + height / 2f - 4, labelWidth, 8, 12);
        drawWrappedText(content, font, value, x + labelWidth + 8, y + height - 15, valueWidth - 16, fontSize, maxLines);
    }

    protected void drawLeaveCompactRow(PDPageContentStream content, PDFont font, float x, float y, float labelWidth, float valueWidth, float height, String label, String value) throws IOException {
        drawBox(content, x, y, labelWidth, height);
        drawBox(content, x + labelWidth, y, valueWidth, height);
        float fontSize = 7f;
        float textY = y + (height - fontSize) / 2f - 1;
        drawCenteredText(content, font, label, x, textY, labelWidth, fontSize, 40);
        drawFittedText(content, font, value, x + labelWidth + 6, textY, valueWidth - 12, fontSize);
    }

    protected void drawClassicApprovalBox(PDPageContentStream content, PDFont font, ApprovalDocument document, List<ApprovalLine> lines) throws IOException {
        List<ApprovalLine> approvals = linesOfType(lines, ApprovalLine.TYPE_APPROVAL);
        int columns = Math.max(2, approvals.size() + 1);
        float x = 326;
        float y = 524;
        float width = 214;
        float titleHeight = 42;
        float rowHeight = 28;
        float signHeight = 64;
        float colWidth = width / columns;
        drawBox(content, x, y + rowHeight * 2 + signHeight, width, titleHeight);
        drawCenteredText(content, font, "위 임 전 결 규 정", x, y + rowHeight * 2 + signHeight + 24, width, 9, 20);
        drawCenteredText(content, font, "(대표이사) 전결", x, y + rowHeight * 2 + signHeight + 9, width, 9, 20);
        for (int col = 0; col < columns; col++) {
            float cx = x + col * colWidth;
            drawBox(content, cx, y + rowHeight + signHeight, colWidth, rowHeight);
            drawBox(content, cx, y + rowHeight, colWidth, signHeight);
            drawBox(content, cx, y, colWidth, rowHeight);
        }
        drawCenteredText(content, font, "기안", x, y + rowHeight + signHeight + 9, colWidth, 8, 8);
        drawCenteredText(content, font, safe(document.getRequester().getPositionName()), x, y + rowHeight + 38, colWidth, 8, 8);
        drawCenteredText(content, font, safe(document.getRequester().getEmpName()), x, y + rowHeight + 20, colWidth, 9, 8);
        drawCenteredText(content, font, dateText(document.getRequestedAt()), x, y + 9, colWidth, 7, 10);
        for (int i = 0; i < approvals.size(); i++) {
            ApprovalLine line = approvals.get(i);
            float cx = x + (i + 1) * colWidth;
            boolean delegated = isDelegatedAction(line);
            drawCenteredText(content, font, String.valueOf(i + 1), cx, y + rowHeight + signHeight + 9, colWidth, 8, 8);
            drawCenteredText(content, font, safe(line.getPositionSnapshot() == null ? line.getApprover().getPositionName() : line.getPositionSnapshot()), cx, y + rowHeight + 40, colWidth, 8, 8);
            drawCenteredText(content, font, delegated ? "대리결재" : approvalStatusForPdf(line), cx, y + rowHeight + 24, colWidth, 8, 8);
            drawCenteredText(content, font, safe(line.getEmpNameSnapshot() == null ? line.getApprover().getEmpName() : line.getEmpNameSnapshot()), cx, y + rowHeight + (delegated ? 13 : 9), colWidth, 8, 8);
            if (delegated) {
                drawCenteredText(content, font, "처리 " + safe(actedName(line)), cx, y + rowHeight + 3, colWidth, 7, 8);
            }
            drawCenteredText(content, font, dateText(line.getSignedAt() == null ? line.getActedAt() : line.getSignedAt()), cx, y + 9, colWidth, 7, 10);
        }
        drawClassicOpinionBox(content, font, lines, x, 374, width, 150);
    }

    protected void drawClassicOpinionBox(PDPageContentStream content, PDFont font, List<ApprovalLine> lines, float x, float y, float width, float height) throws IOException {
        float labelWidth = 58;
        drawBox(content, x, y, labelWidth, height);
        drawBox(content, x + labelWidth, y, width - labelWidth, height);
        drawCenteredText(content, font, "지시", x, y + 94, labelWidth, 9, 8);
        drawCenteredText(content, font, "사항", x, y + 72, labelWidth, 9, 8);
        drawCenteredText(content, font, "(의견)", x, y + 50, labelWidth, 9, 8);
        List<String> opinions = lines.stream()
            .filter(ApprovalLine::isDecisionLine)
            .filter(line -> line.getComment() != null && !line.getComment().isBlank())
            .map(line -> safe(line.getEmpNameSnapshot() == null ? line.getApprover().getEmpName() : line.getEmpNameSnapshot()) + ": " + safe(line.getComment()))
            .toList();
        drawWrappedText(content, font, opinions.isEmpty() ? "-" : String.join("\n", opinions), x + labelWidth + 8, y + height - 18, width - labelWidth - 16, 9, 9);
    }

    protected void drawClassicBody(PDPageContentStream content, PDFont font, ApprovalDocument document) throws IOException {
        float x = 62;
        float y = 186;
        float width = 478;
        float height = 170;
        content.setLineWidth(2.0f);
        content.moveTo(x, y + height + 8);
        content.lineTo(x + width, y + height + 8);
        content.stroke();
        content.setLineWidth(0.7f);
        drawBox(content, x, y, width, height);
        drawWrappedText(content, font, safe(document.getContent()), x + 10, y + height - 18, width - 20, 10, 12);
    }

    protected void drawClassicFooter(PDPageContentStream content, PDFont font, ApprovalDocument document, List<ApprovalLine> lines) throws IOException {
        float x = 62;
        float y = 70;
        float width = 478;
        float rowHeight = 24;
        drawInfoRow(content, font, x, y + rowHeight * 3, 68, width - 68, rowHeight, "수신", lineSummary(lines, ApprovalLine.TYPE_RECEIVER));
        drawInfoRow(content, font, x, y + rowHeight * 2, 68, width - 68, rowHeight, "참조", lineSummary(lines, ApprovalLine.TYPE_REFERENCE));
        drawInfoRow(content, font, x, y + rowHeight, 68, width - 68, rowHeight, "연람", lineSummary(lines, ApprovalLine.TYPE_READER));
        drawInfoRow(content, font, x, y, 68, width - 68, rowHeight, "첨부", "-");
    }

    protected List<ApprovalLine> linesOfType(List<ApprovalLine> lines, String type) {
        return lines.stream()
            .filter(line -> type.equals(line.getLineType()))
            .sorted(java.util.Comparator.comparing(ApprovalLine::getLineOrder))
            .toList();
    }

    protected String lineSummary(List<ApprovalLine> lines, String type) {
        List<ApprovalLine> selected = linesOfType(lines, type);
        if (selected.isEmpty()) {
            return "-";
        }
        return selected.stream()
            .map(line -> safe(line.getDeptNameSnapshot() == null ? (line.getApprover().getDept() == null ? null : line.getApprover().getDept().getDeptName()) : line.getDeptNameSnapshot())
                + " " + safe(line.getEmpNameSnapshot() == null ? line.getApprover().getEmpName() : line.getEmpNameSnapshot()))
            .reduce((left, right) -> left + ", " + right)
            .orElse("-");
    }

    protected String approvalStatusForPdf(ApprovalLine line) {
        if (ApprovalLine.STATUS_APPROVED.equals(line.getStatus())) return "승인";
        if (ApprovalLine.STATUS_REJECTED.equals(line.getStatus())) return "반려";
        if (ApprovalLine.STATUS_PENDING.equals(line.getStatus())) return "대기";
        if (ApprovalLine.STATUS_WAITING.equals(line.getStatus())) return "예정";
        return safe(line.getStatus());
    }

    protected boolean isDelegatedAction(ApprovalLine line) {
        if (line.getActedEmp() == null || line.getAssignedEmp() == null) {
            return false;
        }
        if (line.getActedEmp().getEmpId().equals(line.getAssignedEmp().getEmpId())) {
            return false;
        }
        return ApprovalLine.STATUS_APPROVED.equals(line.getStatus())
            || ApprovalLine.STATUS_REJECTED.equals(line.getStatus())
            || ApprovalLine.STATUS_RECEIPT_COMPLETED.equals(line.getStatus());
    }

    protected String actedName(ApprovalLine line) {
        return line.getActedEmp() == null ? "" : line.getActedEmp().getEmpName();
    }

    protected void drawApprovalStampTable(PDPageContentStream content, PDFont font, ApprovalDocument document, List<ApprovalLine> lines) throws IOException {
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

    protected String signatureDisplayName(ApprovalLine line) {
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

    protected String dateText(LocalDateTime value) {
        return value == null ? "" : DATE_FORMAT.format(value);
    }

    protected String safe(Object value) {
        return value == null ? "-" : String.valueOf(value).replace("\r", " ").replace("\n", " ");
    }

    protected String checkboxLabel(String selected, String label) {
        return (selected != null && selected.contains(label) ? "[x] " : "[ ] ") + label;
    }

    protected String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw BusinessException.badRequest("PDF_HASH_FAILED", "Failed to hash PDF");
        }
    }


    protected record EquipmentApprovalGroups(
        List<ApprovalLine> userLines,
        ApprovalLine peSubmitterLine,
        List<ApprovalLine> peLines,
        ApprovalLine purchaseSubmitterLine,
        List<ApprovalLine> purchaseLines
    ) {
    }

    protected record PdfStampColumn(String position, String name, String date, ApprovalLine line) {
        protected static PdfStampColumn empty() {
            return new PdfStampColumn("", "", "", null);
        }
    }
}
