package com.kjh.groupware.domain.file;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.approval.ApprovalDocumentRepository;
import com.kjh.groupware.domain.approval.ApprovalEquipmentProposalService;
import com.kjh.groupware.domain.approval.ApprovalLineRepository;
import com.kjh.groupware.domain.approval.ApprovalPermissionService;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.equipment.EquipmentManagementService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class FileServiceSensitiveLeaveTest {
    @Test
    void deniedSensitiveLeaveDownloadIsBlockedAndAudited() {
        AttachFileRepository files = mock(AttachFileRepository.class);
        CurrentEmpProvider current = mock(CurrentEmpProvider.class);
        AuditLogService audit = mock(AuditLogService.class);
        ApprovalDocumentRepository documents = mock(ApprovalDocumentRepository.class);
        ApprovalLineRepository lines = mock(ApprovalLineRepository.class);
        ApprovalPermissionService permissions = mock(ApprovalPermissionService.class);
        FileService service = new FileService(
            files, current, audit, documents, lines, permissions,
            mock(ApprovalEquipmentProposalService.class), mock(EquipmentManagementService.class)
        );
        Emp viewer = mock(Emp.class);
        ApprovalDocument document = mock(ApprovalDocument.class);
        AttachFile file = mock(AttachFile.class);
        when(viewer.getEmpId()).thenReturn(9L);
        when(current.getCurrentEmp()).thenReturn(viewer);
        when(file.getDeletedYn()).thenReturn("N");
        when(file.getTargetType()).thenReturn("APPROVAL_DOCUMENT");
        when(file.getTargetId()).thenReturn(40L);
        when(files.findById(7L)).thenReturn(Optional.of(file));
        when(documents.findById(40L)).thenReturn(Optional.of(document));
        when(lines.findByDocumentOrderByLineOrderAsc(document)).thenReturn(List.of());
        org.mockito.Mockito.doThrow(BusinessException.forbidden("APPROVAL_FILE_DOWNLOAD_FORBIDDEN", "권한 없음"))
            .when(permissions).assertCanDownloadAttachment(viewer, document, List.of());

        assertThatThrownBy(() -> service.authorizeDownload(7L, "127.0.0.1", "test"))
            .isInstanceOf(BusinessException.class);

        verify(permissions).assertCanDownloadAttachment(viewer, document, List.of());
        verify(audit).record(
            9L, AuditActionType.ACCESS_DENIED, "attach_file", 7L,
            null, null, "127.0.0.1", "test", "첨부파일 다운로드 권한 없음", false
        );
    }
}
