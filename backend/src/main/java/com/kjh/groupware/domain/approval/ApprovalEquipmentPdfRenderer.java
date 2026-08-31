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
class ApprovalEquipmentPdfRenderer extends ApprovalPdfRenderSupport {

    private final ApprovalEquipmentProposalRepository equipmentProposalRepository;

    ApprovalGeneratedPdf renderEquipmentProposal(ApprovalDocument document, List<ApprovalLine> lines) {
        ApprovalEquipmentProposal proposal = equipmentProposalRepository.findByApprovalApprovalId(document.getApprovalId())
            .orElseThrow(() -> BusinessException.notFound("EQUIPMENT_PROPOSAL_NOT_FOUND", "Equipment proposal was not found"));
        if (ApprovalEquipmentProposal.MOLD_FIXTURE_TEMPLATE_CODE.equals(document.getTemplateCode())) {
            return renderMoldFixtureProposal(document, lines, proposal);
        }
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);
            PDFont font = loadFont(pdf);
            try (PDPageContentStream content = new PDPageContentStream(pdf, page)) {
                content.setLineWidth(1.0f);
                EquipmentApprovalGroups groups = equipmentApprovalGroups(lines, proposal);
                float left = 20;
                float right = 575;
                float width = right - left;
                float middle = left + width / 2f;

                drawDepartmentStamp(content, font, left, 748, 190, "사용부서", requesterStamp(document), groups.userLines());
                drawEquipmentTitle(content, font, 210, 748, 180, equipmentProposalTitle(document), dateText(document.getRequestedAt()));
                drawDepartmentStamp(content, font, 390, 748, 185, "주관부서", sectionLeadStamp(proposal.getPeAssignee(), groups.peSubmitterLine()), groups.peLines());

                drawInfoRow(content, font, left, 724, 70, 115, 24, "요청부서", safe(proposal.getRequestDeptName()));
                drawInfoRow(content, font, left + 185, 724, 70, 115, 24, "완료요구일", safe(proposal.getRequiredCompletionDate()));
                drawInfoRow(content, font, left, 700, 70, 115, 24, "설비명", safe(proposal.getEquipmentName()));
                drawInfoRow(content, font, left + 185, 700, 70, 115, 24, "설비용량(능력)", safe(proposal.getEquipmentCapacity()));
                drawEquipmentTypeBox(content, font, 390, 700, 185, 48, proposal.getRequestType());

                drawLabeledBox(content, font, left, 524, middle - left, 176, "현상", proposal.getCurrentState(), 8);
                drawLabeledBox(content, font, middle, 524, right - middle, 176, "주관부서(PE) 의견", proposal.getPeOpinion(), 8);
                drawLabeledBox(content, font, left, 354, middle - left, 170, "요구사항", proposal.getRequirements(), 8);
                drawLabeledBox(content, font, middle, 398, right - middle, 126, "설계 의견", proposal.getDesignOpinion(), 6);
                drawLabeledBox(content, font, middle, 282, right - middle, 116, "구매 의견", proposal.getPurchaseOpinion(), 5);
                drawLabeledBox(content, font, left, 282, middle - left, 72, "지시 사항", proposal.getInstructions(), 3);

                drawEconomicReviewBox(content, font, left, 198, width, 84, proposal);
                drawAttachmentChecklist(content, font, left, 158, width, proposal);

                drawText(content, font, "* 구매부서에서 작성_사용부서 확인 후 발주서 송부 *", left + 18, 102, 8);
                drawDepartmentStamp(content, font, 390, 86, 185, "발주", sectionLeadStamp(proposal.getPurchaseAssignee(), groups.purchaseSubmitterLine()), groups.purchaseLines());
                drawPurchaseBox(content, font, proposal, left, 10, width);

                drawCenteredText(content, font, "SCTQE-PS-07-02-06(2023.01.05)", left, 1, 180, 7, 34);
                drawCenteredText(content, font, "슝크카본테크놀로지 (유)", 210, 1, 180, 7, 24);
                drawCenteredText(content, font, "A4(210x297)", 480, 1, 90, 7, 12);
            }
            pdf.save(output);
            byte[] bytes = output.toByteArray();
            return new ApprovalGeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate equipment proposal PDF");
        }
    }

    ApprovalGeneratedPdf renderMoldFixtureProposal(ApprovalDocument document, List<ApprovalLine> lines, ApprovalEquipmentProposal proposal) {
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);
            PDFont font = loadFont(pdf);
            try (PDPageContentStream content = new PDPageContentStream(pdf, page)) {
                content.setLineWidth(1.0f);
                EquipmentApprovalGroups groups = equipmentApprovalGroups(lines, proposal);
                float left = 24;
                float right = 571;
                float width = right - left;
                float middle = left + width / 2f;

                drawDepartmentStamp(content, font, left, 746, 180, "사용부서", requesterStamp(document), groups.userLines());
                drawMoldTitle(content, font, left + 180, 746, 190, proposal, dateText(document.getRequestedAt()));
                drawDepartmentStamp(content, font, left + 370, 746, 177, "주관부서", sectionLeadStamp(proposal.getPeAssignee(), groups.peSubmitterLine()), groups.peLines());

                drawInfoRow(content, font, left, 716, 72, 108, 24, "고객사", safe(proposal.getCustomerName()));
                drawInfoRow(content, font, left + 180, 716, 72, 118, 24, "설비명", safe(proposal.getEquipmentName()));
                drawMoldTypeBox(content, font, left + 370, 668, 177, 72, proposal.getRequestType());
                drawInfoRow(content, font, left, 692, 72, 108, 24, "제품(기종)명", safe(proposal.getProductName()));
                drawInfoRow(content, font, left + 180, 692, 72, 118, 24, "사용부서", safe(proposal.getRequestDeptName()));
                drawInfoRow(content, font, left, 668, 72, 108, 24, "용도", safe(proposal.getUsageText()));
                drawInfoRow(content, font, left + 180, 668, 72, 118, 24, "완료요구일", safe(proposal.getRequiredCompletionDate()));

                drawLabeledBox(content, font, left, 592, width, 76, "사유", proposal.getCurrentState(), 4);
                drawMoldPartTable(content, font, proposal, left, 518, width);
                drawLabeledBox(content, font, left, 368, middle - left, 150, "요구사항", proposal.getRequirements(), 7);
                drawLabeledBox(content, font, middle, 368, right - middle, 150, "주관(설계)부서 의견", proposal.getPeOpinion(), 7);
                drawLabeledBox(content, font, left, 292, middle - left, 76, "지시사항", proposal.getInstructions(), 3);
                drawLabeledBox(content, font, middle, 292, right - middle, 76, "구매 의견", proposal.getPurchaseOpinion(), 3);
                drawEconomicReviewBox(content, font, left, 228, width, 64, proposal);
                drawMoldAttachmentChecklist(content, font, left, 204, width, proposal);

                drawText(content, font, "* 구매부서에서 작성_사용부서 경우, 확인 후 발주서 송부 *", left + 18, 150, 8);
                drawDepartmentStamp(content, font, 390, 132, 181, "발주", sectionLeadStamp(proposal.getPurchaseAssignee(), groups.purchaseSubmitterLine()), groups.purchaseLines());
                drawMoldPurchaseBox(content, font, proposal, left, 14, width);

                drawCenteredText(content, font, "SCTQE-PD-08-09-01(2023.01.05)", left, 2, 180, 7, 34);
                drawCenteredText(content, font, "승크카본테크놀로지 (유)", 210, 2, 180, 7, 24);
                drawCenteredText(content, font, "A4 (210 x 297)", 472, 2, 99, 7, 14);
            }
            pdf.save(output);
            byte[] bytes = output.toByteArray();
            return new ApprovalGeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate mold fixture proposal PDF");
        }
    }

    private String equipmentProposalTitle(ApprovalDocument document) {
        if (ApprovalEquipmentProposal.MOLD_FIXTURE_TEMPLATE_CODE.equals(document.getTemplateCode())) {
            return "금형 치공구 품의서";
        }
        return "설 비 품 의 서";
    }

    private void drawEquipmentTitle(PDPageContentStream content, PDFont font, float x, float y, float width, String title, String date) throws IOException {
        drawBox(content, x, y, width, 72);
        drawCenteredText(content, font, title, x, y + 42, width, 16, 20);
        content.setLineWidth(1.4f);
        content.moveTo(x + 18, y + 36);
        content.lineTo(x + width - 18, y + 36);
        content.stroke();
        content.setLineWidth(1.0f);
        drawCenteredText(content, font, "작성일 : " + safe(date), x, y + 14, width, 8, 22);
    }

    private void drawMoldTitle(PDPageContentStream content, PDFont font, float x, float y, float width, ApprovalEquipmentProposal proposal, String date) throws IOException {
        drawBox(content, x, y, width, 72);
        drawText(content, font, checkboxLabel(proposal.getMoldFixtureType(), "금형"), x + 14, y + 56, 8);
        drawText(content, font, checkboxLabel(proposal.getMoldFixtureType(), "치공구"), x + 14, y + 40, 8);
        drawCenteredText(content, font, "품 의 서", x + 42, y + 42, width - 50, 16, 16);
        content.setLineWidth(1.2f);
        content.moveTo(x + 44, y + 34);
        content.lineTo(x + width - 18, y + 34);
        content.stroke();
        content.setLineWidth(1.0f);
        drawCenteredText(content, font, "작성일", x + 44, y + 13, 54, 8, 8);
        drawCenteredText(content, font, safe(date), x + 100, y + 13, width - 112, 8, 20);
    }

    private void drawMoldTypeBox(PDPageContentStream content, PDFont font, float x, float y, float width, float height, String selectedType) throws IOException {
        float labelWidth = 38;
        float rowHeight = height / 3f;
        float textY1 = y + rowHeight * 2 + (rowHeight - 5.5f) / 2f - 1;
        float textY2 = y + rowHeight + (rowHeight - 5.5f) / 2f - 1;
        float textY3 = y + (rowHeight - 5.5f) / 2f - 1;
        drawBox(content, x, y, width, height);
        drawCenteredText(content, font, "구", x, y + height * 0.62f, labelWidth, 9, 2);
        drawCenteredText(content, font, "분", x, y + height * 0.34f, labelWidth, 9, 2);
        String[] types = {"고객지급", "투자", "설계 및 제작", "구매", "수리", "매각", "폐기"};
        float[] dx = {labelWidth + 8, labelWidth + 78, labelWidth + 8, labelWidth + 96, labelWidth + 8, labelWidth + 70, labelWidth + 108};
        float[] dy = {textY1 - y, textY1 - y, textY2 - y, textY2 - y, textY3 - y, textY3 - y, textY3 - y};
        for (int i = 0; i < types.length; i++) {
            drawText(content, font, checkboxLabel(selectedType, types[i]), x + dx[i], y + dy[i], 5.5f);
        }
    }

    private void drawMoldPartTable(PDPageContentStream content, PDFont font, ApprovalEquipmentProposal proposal, float x, float y, float width) throws IOException {
        float row = 18;
        float[] cols = {126, 92, 92, 52, width - 362};
        String[] headers = {"부품명", "CAVITY", "재질", "수량", "금형번호"};
        drawBox(content, x, y, width, row * 4);
        float cx = x;
        for (int i = 0; i < cols.length; i++) {
            drawBox(content, cx, y + row * 3, cols[i], row);
            drawCenteredText(content, font, headers[i], cx, y + row * 3 + 5, cols[i], 8, 16);
            drawBox(content, cx, y, cols[i], row * 3);
            cx += cols[i];
        }
        List<String[]> parts = moldFixtureParts(proposal);
        for (int rowIndex = 0; rowIndex < Math.min(3, parts.size()); rowIndex++) {
            String[] values = parts.get(rowIndex);
            cx = x;
            float textY = y + row * (2 - rowIndex) + 5;
            for (int i = 0; i < cols.length; i++) {
                String text = rowIndex == 2 && parts.size() > 3 && i == 0 ? safe(values[i]) + " 외 " + (parts.size() - 3) + "건" : values[i];
                drawCenteredText(content, font, safe(text), cx, textY, cols[i], 8, 22);
                cx += cols[i];
            }
        }
    }

    private List<String[]> moldFixtureParts(ApprovalEquipmentProposal proposal) {
        List<String[]> parts = new ArrayList<>();
        if (proposal.getMoldPartsJson() != null && !proposal.getMoldPartsJson().isBlank()) {
            try {
                JsonNode root = OBJECT_MAPPER.readTree(proposal.getMoldPartsJson());
                if (root.isArray()) {
                    for (JsonNode node : root) {
                        String[] row = {
                            text(node, "partName"),
                            text(node, "cavity"),
                            text(node, "material"),
                            text(node, "quantity"),
                            text(node, "moldNo")
                        };
                        if (java.util.Arrays.stream(row).anyMatch(value -> value != null && !value.isBlank())) {
                            parts.add(row);
                        }
                    }
                }
            } catch (IOException ignored) {
                parts.clear();
            }
        }
        if (parts.isEmpty()) {
            parts.add(new String[] {
                safe(proposal.getPartName()),
                safe(proposal.getCavity()),
                safe(proposal.getMaterial()),
                safe(proposal.getQuantity()),
                safe(proposal.getMoldNo())
            });
        }
        return parts;
    }

}
