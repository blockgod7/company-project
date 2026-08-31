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
public class ApprovalPdfService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final ApprovalDocumentRepository documentRepository;
    private final ApprovalLineRepository lineRepository;
    private final ApprovalPdfHistoryRepository historyRepository;
    private final ApprovalPdfRenderer renderer;
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
            ApprovalGeneratedPdf generated = renderer.render(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
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
            ApprovalGeneratedPdf generated = renderer.render(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
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
        if (renderer.isRefreshableDocument(document)) {
            refreshEquipmentProposalPdf(document, currentEmp);
        }
        Long pdfFileId = document.getPdfFile().getFileId();
        auditLogService.record(currentEmp.getEmpId(), AuditActionType.PRINT_PDF, "approval_document", approvalId, null, null, ipAddress, userAgent, "PDF 출력 시도", true);
        return fileService.getDownloadableFile(pdfFileId);
    }

    private void refreshEquipmentProposalPdf(ApprovalDocument document, Emp currentEmp) {
        ApprovalGeneratedPdf generated = renderer.render(document, lineRepository.findByDocumentOrderByLineOrderAsc(document));
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

}
