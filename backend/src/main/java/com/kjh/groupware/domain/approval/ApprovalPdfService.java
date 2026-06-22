package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.file.AttachFile;
import com.kjh.groupware.domain.file.AttachFileRepository;
import com.kjh.groupware.domain.file.FileService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
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
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ApprovalPdfService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

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

    @Transactional(readOnly = true)
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
        Long pdfFileId = document.getPdfFile().getFileId();
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.PRINT_PDF, "approval_document", approvalId, null, null, ipAddress, userAgent, "PDF 출력 시도", true);
        return fileService.getDownloadableFile(pdfFileId);
    }

    private GeneratedPdf render(ApprovalDocument document, List<ApprovalLine> lines) {
        if ("DRAFT".equals(document.getTemplateCode())) {
            return renderClassicDraft(document, lines);
        }
        if (ApprovalEquipmentProposal.TEMPLATE_CODE.equals(document.getTemplateCode())) {
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
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);
            PDFont font = loadFont(pdf);
            try (PDPageContentStream content = new PDPageContentStream(pdf, page)) {
                content.setLineWidth(1.0f);
                drawCenteredText(content, font, "설 비 품 의 서", 0, 776, 595, 18, 20);
                drawDepartmentStamp(content, font, 42, 704, "사용부서", document.getRequester(), linesOfType(lines, ApprovalLine.TYPE_APPROVAL));
                drawDepartmentStamp(content, font, 392, 704, "주관부서", proposal.getPeAssignee(), List.of());
                drawInfoRow(content, font, 42, 672, 82, 170, 24, "요청부서", safe(proposal.getRequestDeptName()));
                drawInfoRow(content, font, 294, 672, 82, 170, 24, "완료요구일", safe(proposal.getRequiredCompletionDate()));
                drawInfoRow(content, font, 42, 648, 82, 170, 24, "설비명", safe(proposal.getEquipmentName()));
                drawInfoRow(content, font, 294, 648, 82, 170, 24, "설비용량", safe(proposal.getEquipmentCapacity()));
                drawInfoRow(content, font, 42, 624, 82, 422, 24, "구분", safe(proposal.getRequestType()));

                drawLabeledBox(content, font, 42, 468, 252, 156, "현상", proposal.getCurrentState(), 8);
                drawLabeledBox(content, font, 294, 468, 252, 156, "주관부서(PE) 의견", proposal.getPeOpinion(), 8);
                drawLabeledBox(content, font, 42, 312, 252, 156, "요구사항", proposal.getRequirements(), 8);
                drawLabeledBox(content, font, 294, 390, 252, 78, "설계 의견", proposal.getDesignOpinion(), 4);
                drawLabeledBox(content, font, 294, 312, 252, 78, "구매 의견", proposal.getPurchaseOpinion(), 4);
                drawLabeledBox(content, font, 42, 218, 252, 94, "지시 사항", proposal.getInstructions(), 5);

                drawCenteredText(content, font, "경제성 검토", 42, 196, 504, 11, 14);
                drawBox(content, 42, 184, 504, 28);
                drawLabeledBox(content, font, 42, 104, 252, 80, "사용부서", proposal.getUserEconomicReview(), 4);
                drawLabeledBox(content, font, 294, 104, 252, 80, "주관 부서", proposal.getPeEconomicReview(), 4);

                drawPurchaseBox(content, font, proposal);
                drawText(content, font, "첨부: " + equipmentAttachmentText(proposal), 42, 84, 8);
                drawCenteredText(content, font, "SCTQE-PS-07-02-06(2023.01.05)", 42, 22, 180, 8, 34);
                drawCenteredText(content, font, "슝크카본테크놀로지 (유)", 210, 22, 180, 8, 24);
                drawCenteredText(content, font, "A4(210x297)", 460, 22, 90, 8, 12);
            }
            pdf.save(output);
            byte[] bytes = output.toByteArray();
            return new GeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate equipment proposal PDF");
        }
    }

    private void drawDepartmentStamp(PDPageContentStream content, PDFont font, float x, float y, String label, Emp writer, List<ApprovalLine> approvals) throws IOException {
        drawBox(content, x, y, 154, 72);
        drawCenteredText(content, font, label, x, y + 42, 28, 9, 6);
        float colWidth = 42;
        String[] headers = {"작성", "검토", "승인"};
        for (int i = 0; i < headers.length; i++) {
            float cx = x + 28 + colWidth * i;
            drawBox(content, cx, y + 48, colWidth, 24);
            drawBox(content, cx, y, colWidth, 48);
            drawCenteredText(content, font, headers[i], cx, y + 57, colWidth, 9, 4);
        }
        drawCenteredText(content, font, writer == null ? "" : writer.getEmpName(), x + 30, y + 20, colWidth, 8, 8);
        for (int i = 0; i < Math.min(2, approvals.size()); i++) {
            ApprovalLine line = approvals.get(i);
            drawCenteredText(content, font, signatureDisplayName(line), x + 30 + colWidth * (i + 1), y + 20, colWidth, 8, 8);
        }
    }

    private void drawLabeledBox(PDPageContentStream content, PDFont font, float x, float y, float width, float height, String label, String value, int maxLines) throws IOException {
        drawBox(content, x, y, width, height);
        drawText(content, font, label, x + 8, y + height - 15, 10);
        drawWrappedText(content, font, safe(value), x + 8, y + height - 32, width - 16, 8, maxLines);
    }

    private void drawPurchaseBox(PDPageContentStream content, PDFont font, ApprovalEquipmentProposal proposal) throws IOException {
        float x = 42;
        float y = 34;
        float w = 504;
        float row = 18;
        drawBox(content, x, y, w, row * 3);
        drawInfoRow(content, font, x, y + row * 2, 86, 166, row, "제작업체", safe(proposal.getVendorName()));
        drawInfoRow(content, font, x + 252, y + row * 2, 86, 166, row, "납기", safe(proposal.getDeliveryDueDate()));
        drawInfoRow(content, font, x, y + row, 86, 166, row, "설비/부품명", safe(proposal.getPurchaseItemName()));
        drawInfoRow(content, font, x + 252, y + row, 86, 166, row, "용도", safe(proposal.getPurchaseUsage()));
        drawInfoRow(content, font, x, y, 86, 166, row, "수량/가격", safe(proposal.getQuantity()) + " / " + safe(proposal.getPrice()));
        drawInfoRow(content, font, x + 252, y, 86, 166, row, "비고", safe(proposal.getPurchaseNote()));
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
        drawCenteredText(content, font, label, x, y + 12, labelWidth, 9, 12);
        drawText(content, font, value, x + labelWidth + 8, y + 12, 9);
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
