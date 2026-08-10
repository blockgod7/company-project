package com.kjh.groupware.domain.file;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalDocumentRepository;
import com.kjh.groupware.domain.approval.ApprovalEquipmentProposalService;
import com.kjh.groupware.domain.approval.ApprovalLineRepository;
import com.kjh.groupware.domain.approval.ApprovalPermissionService;
import com.kjh.groupware.domain.board.BoardPostRepository;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.equipment.EquipmentManagementService;
import com.kjh.groupware.domain.notice.NoticeRepository;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class FileServiceSensitiveAccessTest {

    @Test
    void deniedAttachmentDownloadIsAuditedBeforeFileIsReturned() {
        AttachFileRepository fileRepository = mock(AttachFileRepository.class);
        CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
        AuditLogService auditLogService = mock(AuditLogService.class);
        ApprovalDocumentRepository documentRepository = mock(ApprovalDocumentRepository.class);
        ApprovalLineRepository lineRepository = mock(ApprovalLineRepository.class);
        ApprovalPermissionService permissionService = mock(ApprovalPermissionService.class);
        Emp currentEmp = mock(Emp.class);
        when(currentEmp.getEmpId()).thenReturn(7L);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(currentEmp);
        ApprovalDocument document = mock(ApprovalDocument.class);
        when(documentRepository.findById(10L)).thenReturn(Optional.of(document));
        when(lineRepository.findByDocumentOrderByLineOrderAsc(document)).thenReturn(List.of());
        org.mockito.Mockito.doThrow(BusinessException.forbidden("APPROVAL_FILE_DOWNLOAD_FORBIDDEN", "첨부파일 다운로드 권한이 없습니다."))
            .when(permissionService).assertCanDownloadAttachment(currentEmp, document, List.of());
        AttachFile file = AttachFile.builder()
            .targetType("APPROVAL_DOCUMENT")
            .targetId(10L)
            .originalFileName("birth.pdf")
            .storedFileName("stored.pdf")
            .storagePath("uploads")
            .fileSize(1L)
            .fileExt("pdf")
            .build();
        ReflectionTestUtils.setField(file, "fileId", 20L);
        when(fileRepository.findById(20L)).thenReturn(Optional.of(file));
        FileService service = new FileService(
            fileRepository,
            currentEmpProvider,
            auditLogService,
            documentRepository,
            lineRepository,
            permissionService,
            mock(ApprovalEquipmentProposalService.class),
            mock(EquipmentManagementService.class),
            mock(BoardPostRepository.class),
            mock(NoticeRepository.class)
        );

        assertThatThrownBy(() -> service.authorizeDownload(20L, "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);
        verify(auditLogService).record(
            eq(7L), eq(AuditActionType.ACCESS_DENIED), eq("attach_file"), eq(20L),
            isNull(), isNull(), eq("127.0.0.1"), eq("test"), eq("첨부파일 다운로드 권한 없음"), eq(false)
        );
    }
}
