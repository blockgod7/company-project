package com.kjh.groupware.domain.approval;

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
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalPdfService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLineRepository lineRepository;
    private final ApprovalEquipmentProposalRepository equipmentProposalRepository;
    private final ApprovalPdfHistoryRepository historyRepository;
    private final AttachFileRepository attachFileRepository;
    private final FileService fileService;
    private final CurrentEmpProvider currentEmpProvider;
    private final ApprovalPermissionService permissionService;
    private final AuditLogService auditLogService;

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

    @Transactional
    public AttachFile getGeneratedPdf(Long approvalId, String ipAddress, String userAgent) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        ApprovalDocument document = documentRepository.findById(approvalId)
            .orElseThrow(() -> BusinessException.notFound("APPROVAL_NOT_FOUND", "Approval document was not found"));
        try {
            permissionService.assertCanPrintPdf(currentEmp, document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
        } catch (BusinessException ex) {
            auditLogService.record(currentEmp.getEmpId(), AuditActionType.ACCESS_DENIED, "approval_document", approvalId, null, null, ipAddress, userAgent, "PDF 출력 권한 없음", false);
            throw ex;
        }
        if (ApprovalDocument.PDF_STATUS_GENERATING.equals(document.getPdfStatus())) {
            throw BusinessException.badRequest("PDF_GENERATING", "PDF is still being generated");
        }
        if (ApprovalDocument.PDF_STATUS_FAILED.equals(document.getPdfStatus())) {
            throw BusinessException.badRequest("PDF_FAILED", document.getPdfErrorMessage());
        }
        if (!ApprovalDocument.PDF_STATUS_GENERATED.equals(document.getPdfStatus()) || document.getPdfFile() == null) {
            throw BusinessException.notFound("PDF_NOT_FOUND", "PDF has not been generated");
        }
        if (ApprovalEquipmentProposal.isProposalTemplate(document.getTemplateCode())) {
            refreshEquipmentProposalPdf(document, currentEmp);
        }
        Long pdfFileId = document.getPdfFile().getFileId();
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.PRINT_PDF, "approval_document", approvalId, null, null, ipAddress, userAgent, "PDF 출력 시도", true);
        return fileService.getDownloadableFile(pdfFileId);
    }

    private void refreshEquipmentProposalPdf(ApprovalDocument document, Emp currentEmp) {
        GeneratedPdf generated = render(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
        AttachFile file = fileService.saveGeneratedFile(
            "APPROVAL_PDF",
            document.getApprovalId(),
            document.getDocumentNo() + ".pdf",
            generated.bytes(),
            "application/pdf",
            currentEmp
        );
        document.completePdfGeneration(file, generated.hash());
    }

    private GeneratedPdf render(ApprovalDocument document, List<ApprovalLine> lines) {
        if ("DRAFT".equals(document.getTemplateCode())) {
            return renderClassicDraft(document, lines);
        }
        if (ApprovalEquipmentProposal.isProposalTemplate(document.getTemplateCode())) {
            return renderEquipmentProposal(document, lines);
        }
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

    private GeneratedPdf renderClassicDraft(ApprovalDocument document, List<ApprovalLine> lines) {
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);
            PDFont font = loadFont(pdf);
            try (PDPageContentStream content = new PDPageContentStream(pdf, page)) {
                drawClassicLogo(pdf, content);
                drawCenteredText(content, font, "기 안 서", 0, 735, 595, 18, 20);
                drawClassicDraftInfo(content, font, document, lines);
                drawClassicApprovalBox(content, font, document, lines);
                drawClassicBody(content, font, document);
                drawClassicFooter(content, font, document, lines);
            }
            pdf.save(output);
            byte[] bytes = output.toByteArray();
            return new GeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate classic draft PDF");
        }
    }

    private GeneratedPdf renderEquipmentProposal(ApprovalDocument document, List<ApprovalLine> lines) {
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
            return new GeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate equipment proposal PDF");
        }
    }

    private GeneratedPdf renderMoldFixtureProposal(ApprovalDocument document, List<ApprovalLine> lines, ApprovalEquipmentProposal proposal) {
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
            return new GeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate mold fixture proposal PDF");
        }
    }

    private void drawDepartmentStamp(PDPageContentStream content, PDFont font, float x, float y, float width, String label, PdfStampColumn writer, List<ApprovalLine> approvalLines) throws IOException {
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

        drawBox(content, x, y, width, 72);
        float labelWidth = Math.max(30, Math.min(38, width * 0.18f));
        drawVerticalText(content, font, label, x, y + 52, labelWidth, 8);
        List<PdfStampColumn> columns = new ArrayList<>();
        columns.add(writer == null ? PdfStampColumn.empty() : writer);
        columns.addAll(approvalColumns);
        int columnCount = Math.max(2, columns.size());
        while (columns.size() < columnCount) {
            columns.add(PdfStampColumn.empty());
        }
        float colWidth = (width - labelWidth) / columnCount;
        for (int i = 0; i < columnCount; i++) {
            float cx = x + labelWidth + colWidth * i;
            drawBox(content, cx, y + 48, colWidth, 24);
            drawBox(content, cx, y, colWidth, 48);
            drawCenteredText(content, font, stampHeader(i, columnCount), cx, y + 57, colWidth, 8, 4);
            PdfStampColumn column = columns.get(i);
            drawCenteredText(content, font, column.position(), cx, y + 34, colWidth, 7, 9);
            drawCenteredText(content, font, column.name(), cx, y + 21, colWidth, 9, 8);
            drawCenteredText(content, font, column.date(), cx, y + 8, colWidth, 6, 10);
        }
    }

    private String stampHeader(int index, int columnCount) {
        if (index == 0) {
            return "작성";
        }
        return index == columnCount - 1 ? "승인" : "검토";
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

    private String text(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        return value == null || value.isNull() ? "" : value.asText("");
    }

    private void drawMoldAttachmentChecklist(PDPageContentStream content, PDFont font, float x, float y, float width, ApprovalEquipmentProposal proposal) throws IOException {
        drawBox(content, x, y, width, 24);
        drawText(content, font, "첨부 :", x + 8, y + 8, 8);
        drawText(content, font, checkboxLabel(proposal.getAttachmentContractYn(), "분말금형기초자료"), x + 42, y + 8, 8);
        drawText(content, font, checkboxLabel(proposal.getAttachmentQuoteYn(), "제품도면"), x + 150, y + 8, 8);
        drawText(content, font, checkboxLabel(proposal.getAttachmentDrawingYn(), "부품도면"), x + 222, y + 8, 8);
        drawText(content, font, checkboxLabel(proposal.getAttachmentSpecYn(), "기타"), x + 294, y + 8, 8);
        drawText(content, font, "( " + safe(proposal.getAttachmentEtc()) + " )", x + 332, y + 8, 8);
    }

    private void drawMoldPurchaseBox(PDPageContentStream content, PDFont font, ApprovalEquipmentProposal proposal, float x, float y, float w) throws IOException {
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

    private String blankToDash(String value, String fallback) {
        if (value != null && !value.isBlank()) {
            return value;
        }
        return fallback == null || fallback.isBlank() ? "-" : fallback;
    }

    private void drawEquipmentTypeBox(PDPageContentStream content, PDFont font, float x, float y, float width, float height, String selectedType) throws IOException {
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

    private void drawLabeledBox(PDPageContentStream content, PDFont font, float x, float y, float width, float height, String label, String value, int maxLines) throws IOException {
        drawBox(content, x, y, width, height);
        drawText(content, font, label, x + 8, y + height - 15, 10);
        content.setLineWidth(0.7f);
        content.moveTo(x + 8, y + height - 20);
        content.lineTo(x + Math.min(width - 8, 100), y + height - 20);
        content.stroke();
        content.setLineWidth(1.0f);
        drawWrappedText(content, font, safe(value), x + 8, y + height - 32, width - 16, 8, maxLines);
    }

    private void drawEconomicReviewBox(PDPageContentStream content, PDFont font, float x, float y, float width, float height, ApprovalEquipmentProposal proposal) throws IOException {
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

    private void drawAttachmentChecklist(PDPageContentStream content, PDFont font, float x, float y, float width, ApprovalEquipmentProposal proposal) throws IOException {
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

    private void drawPurchaseBox(PDPageContentStream content, PDFont font, ApprovalEquipmentProposal proposal, float x, float y, float w) throws IOException {
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

    private void drawPurchaseInfoRow(PDPageContentStream content, PDFont font, float x, float y, float labelWidth, float valueWidth, float height, String label, String value) throws IOException {
        drawBox(content, x, y, labelWidth, height);
        drawBox(content, x + labelWidth, y, valueWidth, height);
        drawCenteredText(content, font, label, x, y + height / 2 - 3, labelWidth, 8, 12);
        drawFittedText(content, font, value, x + labelWidth + 6, y + height / 2 - 3, valueWidth - 12, 7);
    }

    private String equipmentAttachmentText(ApprovalEquipmentProposal proposal) {
        java.util.ArrayList<String> labels = new java.util.ArrayList<>();
        if ("Y".equals(proposal.getAttachmentContractYn())) labels.add("계약서");
        if ("Y".equals(proposal.getAttachmentQuoteYn())) labels.add("견적서");
        if ("Y".equals(proposal.getAttachmentDrawingYn())) labels.add("도면");
        if ("Y".equals(proposal.getAttachmentSpecYn())) labels.add("설비사양서");
        if (proposal.getAttachmentEtc() != null && !proposal.getAttachmentEtc().isBlank()) labels.add("기타(" + proposal.getAttachmentEtc() + ")");
        return labels.isEmpty() ? "-" : String.join(", ", labels);
    }

    private EquipmentApprovalGroups equipmentApprovalGroups(List<ApprovalLine> lines, ApprovalEquipmentProposal proposal) {
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

    private boolean sameEmp(ApprovalLine line, Emp emp) {
        Long lineEmpId = approvalLinePersonId(line);
        return lineEmpId != null && emp != null && lineEmpId.equals(emp.getEmpId());
    }

    private Long approvalLinePersonId(ApprovalLine line) {
        if (line.getAssignedEmp() != null) {
            return line.getAssignedEmp().getEmpId();
        }
        return line.getApprover() == null ? null : line.getApprover().getEmpId();
    }

    private PdfStampColumn requesterStamp(ApprovalDocument document) {
        Emp requester = document.getRequester();
        return new PdfStampColumn(
            safe(requester.getPositionName()),
            safe(requester.getEmpName()),
            dateText(document.getRequestedAt()),
            null
        );
    }

    private PdfStampColumn sectionLeadStamp(Emp assignee, ApprovalLine leadLine) {
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

    private PdfStampColumn approvalStamp(ApprovalLine line) {
        boolean signed = ApprovalLine.STATUS_APPROVED.equals(line.getStatus()) || ApprovalLine.STATUS_REJECTED.equals(line.getStatus());
        return new PdfStampColumn(
            safe(line.getPositionSnapshot() == null ? line.getApprover().getPositionName() : line.getPositionSnapshot()),
            signed ? safe(signatureDisplayName(line)) : "",
            signed ? dateText(line.getSignedAt() == null ? line.getActedAt() : line.getSignedAt()) : "",
            line
        );
    }

    private void drawClassicLogo(PDDocument pdf, PDPageContentStream content) throws IOException {
        Path logoPath = Path.of("..", "frontend", "src", "assets", "schunk-carbon-logo.png").toAbsolutePath().normalize();
        if (Files.exists(logoPath)) {
            PDImageXObject logo = PDImageXObject.createFromFileByContent(logoPath.toFile(), pdf);
            content.drawImage(logo, 68, 705, 148, 78);
            return;
        }
        drawBox(content, 68, 720, 148, 48);
    }

    private void drawClassicDraftInfo(PDPageContentStream content, PDFont font, ApprovalDocument document, List<ApprovalLine> lines) throws IOException {
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

    private void drawInfoRow(PDPageContentStream content, PDFont font, float x, float y, float labelWidth, float valueWidth, float height, String label, String value) throws IOException {
        drawBox(content, x, y, labelWidth, height);
        drawBox(content, x + labelWidth, y, valueWidth, height);
        float fontSize = 7f;
        float textY = y + (height - fontSize) / 2f - 1;
        drawCenteredText(content, font, label, x, textY, labelWidth, fontSize, 12);
        drawFittedText(content, font, value, x + labelWidth + 6, textY, valueWidth - 12, fontSize);
    }

    private void drawClassicApprovalBox(PDPageContentStream content, PDFont font, ApprovalDocument document, List<ApprovalLine> lines) throws IOException {
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

    private void drawClassicOpinionBox(PDPageContentStream content, PDFont font, List<ApprovalLine> lines, float x, float y, float width, float height) throws IOException {
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

    private void drawClassicBody(PDPageContentStream content, PDFont font, ApprovalDocument document) throws IOException {
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

    private void drawClassicFooter(PDPageContentStream content, PDFont font, ApprovalDocument document, List<ApprovalLine> lines) throws IOException {
        float x = 62;
        float y = 70;
        float width = 478;
        float rowHeight = 24;
        drawInfoRow(content, font, x, y + rowHeight * 3, 68, width - 68, rowHeight, "수신", lineSummary(lines, ApprovalLine.TYPE_RECEIVER));
        drawInfoRow(content, font, x, y + rowHeight * 2, 68, width - 68, rowHeight, "참조", lineSummary(lines, ApprovalLine.TYPE_REFERENCE));
        drawInfoRow(content, font, x, y + rowHeight, 68, width - 68, rowHeight, "연람", lineSummary(lines, ApprovalLine.TYPE_READER));
        String attachments = attachFileRepository.findByTargetTypeAndTargetIdAndDeletedYnOrderByFileIdAsc("APPROVAL_DOCUMENT", document.getApprovalId(), "N").stream()
            .map(AttachFile::getOriginalFileName)
            .toList()
            .stream()
            .reduce((left, right) -> left + ", " + right)
            .orElse("-");
        drawInfoRow(content, font, x, y, 68, width - 68, rowHeight, "첨부", attachments);
    }

    private List<ApprovalLine> linesOfType(List<ApprovalLine> lines, String type) {
        return lines.stream()
            .filter(line -> type.equals(line.getLineType()))
            .sorted(java.util.Comparator.comparing(ApprovalLine::getLineOrder))
            .toList();
    }

    private String lineSummary(List<ApprovalLine> lines, String type) {
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

    private String approvalStatusForPdf(ApprovalLine line) {
        if (ApprovalLine.STATUS_APPROVED.equals(line.getStatus())) return "승인";
        if (ApprovalLine.STATUS_REJECTED.equals(line.getStatus())) return "반려";
        if (ApprovalLine.STATUS_PENDING.equals(line.getStatus())) return "대기";
        if (ApprovalLine.STATUS_WAITING.equals(line.getStatus())) return "예정";
        return safe(line.getStatus());
    }

    private boolean isDelegatedAction(ApprovalLine line) {
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

    private String actedName(ApprovalLine line) {
        return line.getActedEmp() == null ? "" : line.getActedEmp().getEmpName();
    }

    private void drawBox(PDPageContentStream content, float x, float y, float width, float height) throws IOException {
        content.addRect(x, y, width, height);
        content.stroke();
    }

    private void drawText(PDPageContentStream content, PDFont font, String text, float x, float y, float fontSize) throws IOException {
        content.beginText();
        content.setFont(font, fontSize);
        content.newLineAtOffset(x, y);
        content.showText(safe(text));
        content.endText();
    }

    private void drawFittedText(PDPageContentStream content, PDFont font, String text, float x, float y, float width, float fontSize) throws IOException {
        String value = fitToWidth(font, safe(text), fontSize, Math.max(4, width));
        drawText(content, font, value, x, y, fontSize);
    }

    private void drawVerticalText(PDPageContentStream content, PDFont font, String text, float x, float y, float width, float fontSize) throws IOException {
        String value = text == null ? "" : text;
        float lineY = y;
        for (int i = 0; i < value.length(); i++) {
            drawCenteredText(content, font, String.valueOf(value.charAt(i)), x, lineY, width, fontSize, 1);
            lineY -= fontSize + 5;
        }
    }

    private void drawWrappedText(PDPageContentStream content, PDFont font, String text, float x, float startY, float width, float fontSize, int maxLines) throws IOException {
        float y = startY;
        int lines = 0;
        int maxChars = Math.max(12, (int) (width / (fontSize * 0.72f)));
        String printable = text == null ? "-" : text.replace("\r\n", "\n").replace('\r', '\n');
        for (String sourceLine : printable.split("\\n")) {
            for (String wrapped : wrap(safe(sourceLine), maxChars)) {
                if (lines++ >= maxLines) {
                    return;
                }
                drawText(content, font, wrapped, x, y, fontSize);
                y -= fontSize + 5;
            }
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
        value = fitToWidth(font, value, fontSize, Math.max(4, width - 4));
        float textWidth = font.getStringWidth(value) / 1000 * fontSize;
        content.beginText();
        content.setFont(font, fontSize);
        content.newLineAtOffset(x + Math.max(2, (width - textWidth) / 2), y);
        content.showText(value);
        content.endText();
    }

    private String fitToWidth(PDFont font, String text, float fontSize, float width) throws IOException {
        String value = text == null ? "" : text;
        while (!value.isEmpty() && font.getStringWidth(value) / 1000 * fontSize > width) {
            value = value.substring(0, value.length() - 1);
        }
        return value;
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

    private String checkboxLabel(String selected, String label) {
        return (selected != null && selected.contains(label) ? "[x] " : "[ ] ") + label;
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

    private record EquipmentApprovalGroups(
        List<ApprovalLine> userLines,
        ApprovalLine peSubmitterLine,
        List<ApprovalLine> peLines,
        ApprovalLine purchaseSubmitterLine,
        List<ApprovalLine> purchaseLines
    ) {
    }

    private record PdfStampColumn(String position, String name, String date, ApprovalLine line) {
        private static PdfStampColumn empty() {
            return new PdfStampColumn("", "", "", null);
        }
    }
}
