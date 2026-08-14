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
class ApprovalPdfRenderer extends ApprovalPdfRenderSupport {

    private final ApprovalStandardPdfRenderer standardRenderer;
    private final ApprovalEquipmentPdfRenderer equipmentRenderer;
    private final AttachFileRepository attachFileRepository;

    ApprovalGeneratedPdf render(ApprovalDocument document, List<ApprovalLine> lines) {
        if ("DRAFT".equals(document.getTemplateCode())) {
            return renderClassicDraft(document, lines);
        }
        if (isLeaveDocument(document)) {
            return renderLeaveRequest(document, lines);
        }
        if (isPurchaseDocument(document)) {
            return standardRenderer.renderPurchaseRequest(document, lines);
        }
        if (isTrainingRequestDocument(document)) {
            return standardRenderer.renderTrainingRequest(document, lines);
        }
        if (isTrainingReportDocument(document)) {
            return standardRenderer.renderTrainingReport(document, lines);
        }
        if (ApprovalEquipmentProposal.isProposalTemplate(document.getTemplateCode())) {
            return equipmentRenderer.renderEquipmentProposal(document, lines);
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
            return new ApprovalGeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate PDF");
        }
    }

    boolean isRefreshableDocument(ApprovalDocument document) {
        return isLeaveDocument(document) || isPurchaseDocument(document) || isTrainingDocument(document)
            || ApprovalEquipmentProposal.isProposalTemplate(document.getTemplateCode());
    }

    private boolean isLeaveDocument(ApprovalDocument document) {
        if ("LEAVE".equals(document.getTemplateCode()) || "LEAVE_CANCEL".equals(document.getTemplateCode())) {
            return true;
        }
        JsonNode fields = formFields(document.getFormDataJson());
        return fields.has("leaveSelectionsJson")
            || fields.has("annualLeaveDays")
            || fields.has("leaveType") && (fields.has("startDate") || fields.has("endDate"));
    }

    private boolean isPurchaseDocument(ApprovalDocument document) {
        return "PURCHASE".equals(document.getTemplateCode());
    }

    private boolean isTrainingRequestDocument(ApprovalDocument document) {
        return "TRAINING_REQUEST".equals(document.getTemplateCode());
    }

    private boolean isTrainingReportDocument(ApprovalDocument document) {
        return "TRAINING_REPORT".equals(document.getTemplateCode());
    }

    private boolean isTrainingDocument(ApprovalDocument document) {
        return isTrainingRequestDocument(document) || isTrainingReportDocument(document);
    }


    private ApprovalGeneratedPdf renderClassicDraft(ApprovalDocument document, List<ApprovalLine> lines) {
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
            return new ApprovalGeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate classic draft PDF");
        }
    }

    @Override
    protected void drawClassicFooter(PDPageContentStream content, PDFont font, ApprovalDocument document, List<ApprovalLine> lines) throws IOException {
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

    private ApprovalGeneratedPdf renderLeaveRequest(ApprovalDocument document, List<ApprovalLine> lines) {
        return useLegacyLeaveLayout(document)
            ? renderLegacyLeaveRequest(document, lines)
            : renderWebLeaveRequest(document, lines);
    }

    private ApprovalGeneratedPdf renderWebLeaveRequest(ApprovalDocument document, List<ApprovalLine> lines) {
        JsonNode fields = formFields(document.getFormDataJson());
        boolean cancel = "LEAVE_CANCEL".equals(document.getTemplateCode());
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4); pdf.addPage(page); PDFont font = loadFont(pdf);
            try (PDPageContentStream content = new PDPageContentStream(pdf, page)) {
                content.setLineWidth(0.8f);
                drawText(content, font, "전자결재 · 휴가", 60, 785, 9);
                drawText(content, font, cancel ? "휴가 취소 신청" : "휴가 신청", 60, 752, 22);
                drawText(content, font, safe(document.getTitle()), 60, 728, 10);

                List<ApprovalLine> approvals = linesOfType(lines, ApprovalLine.TYPE_APPROVAL);
                List<ApprovalLine> receivers = linesOfType(lines, ApprovalLine.TYPE_RECEIVER);
                drawDepartmentStamp(content, font, 60, 620, 230, "결재", requesterStamp(document), approvals);
                drawDepartmentStamp(content, font, 306, 620, 230, "수신", null, receivers);

                float x=60, width=476, row=30;
                drawInfoRow(content,font,x,590,70,88,row,"신청자",safe(document.getRequester().getEmpName()));
                drawInfoRow(content,font,x+158,590,60,100,row,"부서",safe(document.getDraftDeptName()));
                drawInfoRow(content,font,x+318,590,58,100,row,"신청일",dateText(document.getRequestedAt()));

                float cardY=530, cardW=width/3f;
                drawMetricCard(content,font,x,cardY,cardW,"총 휴가 일수",dayText(text(fields,"totalAnnualDays")));
                drawMetricCard(content,font,x+cardW,cardY,cardW,"신청 전 사용 일수",dayText(text(fields,"usedAnnualDays")));
                drawMetricCard(content,font,x+cardW*2,cardY,cardW,cancel?"이번 취소 일수":"이번 신청 일수",dayText(text(fields,"days")));

                drawLeaveTextRow(content,font,x,430,86,width-86,80,cancel?"취소 날짜":"신청 날짜",leaveSelectionText(fields),7.5f,6);
                drawLeaveTextRow(content,font,x,350,86,width-86,80,"상세 정보",leaveDetailText(fields));
                drawLeaveTextRow(content,font,x,270,86,width-86,80,"신청 사유",text(fields,"leaveReason"));
                drawText(content,font,"문서번호 " + safe(document.getDocumentNo()) + " · 최종 상태 " + safe(document.getStatus()),x,240,8);
                drawText(content,font,"시스템 생성 문서 · 생성 " + java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")),x,218,7);
            }
            pdf.save(output); byte[] bytes=output.toByteArray(); return new ApprovalGeneratedPdf(bytes,sha256(bytes));
        } catch(IOException ex){throw BusinessException.badRequest("PDF_GENERATION_FAILED","Failed to generate leave request PDF");}
    }

    private ApprovalGeneratedPdf renderLegacyLeaveRequest(ApprovalDocument document, List<ApprovalLine> lines) {
        JsonNode fields = formFields(document.getFormDataJson());
        boolean cancel = "LEAVE_CANCEL".equals(document.getTemplateCode());
        try (PDDocument pdf = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.A4);
            pdf.addPage(page);
            PDFont font = loadFont(pdf);
            try (PDPageContentStream content = new PDPageContentStream(pdf, page)) {
                content.setLineWidth(1.0f);
                drawCenteredText(content, font, cancel ? "휴가 취소계" : "휴가계 (연차, 반차, 교육 등)", 0, 770, 595, 18, 28);
                List<ApprovalLine> approvalLines = linesOfType(lines, ApprovalLine.TYPE_APPROVAL);
                List<ApprovalLine> receiverLines = linesOfType(lines, ApprovalLine.TYPE_RECEIVER);
                float approvalWidth = Math.min(230, 34 + Math.max(1, approvalLines.size() + 1) * 72);
                float receiverWidth = Math.min(220, 34 + Math.max(1, receiverLines.size()) * 72);
                drawDepartmentStamp(content, font, 60, 672, approvalWidth, "결재", requesterStamp(document), approvalLines);
                drawDepartmentStamp(content, font, 536 - receiverWidth, 672, receiverWidth, "수신", null, receiverLines);

                drawText(content, font, "신청자 : " + safe(document.getRequester().getEmpName()), 80, 634, 9);
                drawText(content, font, "TEL :", 210, 634, 9);
                drawText(content, font, "기 타 :", 378, 634, 9);
                drawText(content, font, "부 서 : " + safe(document.getDraftDeptName()), 80, 606, 9);
                drawText(content, font, "직 급 : " + safe(document.getRequester().getPositionName()), 245, 606, 9);
                drawText(content, font, "신청일 : " + dateText(document.getRequestedAt()), 378, 606, 9);

                content.setLineWidth(1.5f);
                content.moveTo(60, 586);
                content.lineTo(536, 586);
                content.stroke();
                content.setLineWidth(0.8f);

                float x = 60;
                float y = 548;
                float label = 112;
                float value = 364;
                float row = 34;
                drawInfoRow(content, font, x, y, label, value, row, "제 목", safe(document.getTitle()));
                drawInfoRow(content, font, x, y - row, label, value, row, cancel ? "취소기간" : "신청기간", leaveRangeText(fields));
                drawInfoRow(content, font, x, y - row * 2, label, value, row, cancel ? "취소구분" : "신청구분", text(fields, "leaveType"));
                drawLeaveCompactRow(content, font, x, y - row * 3, 260, value + label - 260, row, "신청 전 연차사용 일수 / 총 연차일수", leaveAnnualTotalText(fields));
                drawInfoRow(content, font, x, y - row * 4, label, value, row, cancel ? "취소 연차일수" : "연차 사용일수", dayText(text(fields, "days")));
                drawInfoRow(content, font, x, y - row * 5, label, value, row, "신청 후 잔여 연차일수", dayText(leaveRemainingAnnualText(fields)));
            }
            pdf.save(output);
            byte[] bytes = output.toByteArray();
            return new ApprovalGeneratedPdf(bytes, sha256(bytes));
        } catch (IOException ex) {
            throw BusinessException.badRequest("PDF_GENERATION_FAILED", "Failed to generate leave request PDF");
        }
    }

    private boolean useLegacyLeaveLayout(ApprovalDocument document) {
        try {
            JsonNode snapshot = OBJECT_MAPPER.readTree(document.getTemplateSnapshotJson());
            String layout = snapshot.path("printLayoutJson").asText("");
            return !layout.isBlank() && "LEGACY".equalsIgnoreCase(OBJECT_MAPPER.readTree(layout).path("leaveLayout").asText(""));
        } catch (Exception ignored) {
            return false;
        }
    }

    private void drawMetricCard(PDPageContentStream content, PDFont font, float x, float y, float width, String label, String value) throws IOException {
        drawBox(content,x,y,width,54); drawCenteredText(content,font,label,x,y+34,width,8,24); drawCenteredText(content,font,value,x,y+13,width,13,24);
    }

    private String leaveSelectionText(JsonNode fields) {
        String raw=text(fields,"leaveSelectionsJson"); if(raw.isBlank()) return leaveRangeText(fields)+" · "+text(fields,"leaveType");
        try { JsonNode items=OBJECT_MAPPER.readTree(raw); List<String> values=new ArrayList<>(); for(JsonNode item:items){String date=item.path("date").asText();String shortDate=date.length()>=10?date.substring(5):date;String days=item.path("days").asText("");values.add(shortDate+" "+item.path("type").asText()+(days.isBlank()?"":"("+days+"일)"));} return String.join(" · ",values); }
        catch(Exception ignored){return leaveRangeText(fields);}
    }

    private String leaveDetailText(JsonNode fields) {
        List<String> values=new ArrayList<>();
        if(!text(fields,"familyEventType").isBlank()) values.add("경조: "+BereavementCatalog.eventLabel(text(fields,"familyEventType"))+" / "+BereavementCatalog.relationLabel(text(fields,"familyRelation")));
        if(!text(fields,"accidentReceiptInfo").isBlank()) values.add("산재 접수: "+text(fields,"accidentReceiptInfo"));
        if(!text(fields,"expectedBirthDate").isBlank()) values.add("출산 예정일: "+text(fields,"expectedBirthDate"));
        if(!text(fields,"actualBirthDate").isBlank()) values.add("실제 출산일: "+text(fields,"actualBirthDate"));
        if(!text(fields,"earlyLeaveStartTime").isBlank()) values.add("조퇴 시작: "+text(fields,"earlyLeaveStartTime")+" / "+text(fields,"earlyLeavePayType"));
        if("Y".equalsIgnoreCase(text(fields,"multipleBirthYn"))) values.add("배우자 출산: 다태아(25일 한도)");
        return values.isEmpty()?"-":String.join("\n",values);
    }

}
