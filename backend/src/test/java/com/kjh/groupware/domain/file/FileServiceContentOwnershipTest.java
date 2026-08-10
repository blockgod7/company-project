package com.kjh.groupware.domain.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.approval.ApprovalDocumentRepository;
import com.kjh.groupware.domain.approval.ApprovalEquipmentProposalService;
import com.kjh.groupware.domain.approval.ApprovalLineRepository;
import com.kjh.groupware.domain.approval.ApprovalPermissionService;
import com.kjh.groupware.domain.board.BoardPost;
import com.kjh.groupware.domain.board.BoardPostRepository;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.equipment.EquipmentManagementService;
import com.kjh.groupware.domain.notice.Notice;
import com.kjh.groupware.domain.notice.NoticeRepository;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.multipart.MultipartFile;

class FileServiceContentOwnershipTest {

    @Test
    void boardAttachmentUploadRejectsEmployeeWhoDidNotWritePost() {
        TestContext context = context();
        BoardPost post = mock(BoardPost.class);
        Emp writer = employee(1L);
        when(post.getWriter()).thenReturn(writer);
        when(post.getDeletedYn()).thenReturn("N");
        when(context.boardPosts.findById(10L)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> context.service.upload("BOARD_POST", 10L, upload(), "127.0.0.1", "test"))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getCode()).isEqualTo("BOARD_POST_FILE_WRITE_FORBIDDEN")
            );
    }

    @Test
    void noticeAttachmentUploadRejectsEmployeeWhoDidNotWriteNotice() {
        TestContext context = context();
        Notice notice = mock(Notice.class);
        Emp writer = employee(1L);
        when(notice.getWriter()).thenReturn(writer);
        when(notice.getDeletedYn()).thenReturn("N");
        when(context.notices.findById(20L)).thenReturn(Optional.of(notice));

        assertThatThrownBy(() -> context.service.upload("NOTICE", 20L, upload(), "127.0.0.1", "test"))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getCode()).isEqualTo("NOTICE_FILE_WRITE_FORBIDDEN")
            );
    }

    private TestContext context() {
        CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
        Emp currentEmployee = employee(2L);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(currentEmployee);
        BoardPostRepository boardPosts = mock(BoardPostRepository.class);
        NoticeRepository notices = mock(NoticeRepository.class);
        FileService service = new FileService(
            mock(AttachFileRepository.class),
            currentEmpProvider,
            mock(AuditLogService.class),
            mock(ApprovalDocumentRepository.class),
            mock(ApprovalLineRepository.class),
            mock(ApprovalPermissionService.class),
            mock(ApprovalEquipmentProposalService.class),
            mock(EquipmentManagementService.class),
            boardPosts,
            notices
        );
        return new TestContext(service, boardPosts, notices);
    }

    private Emp employee(Long empId) {
        Emp employee = mock(Emp.class);
        when(employee.getEmpId()).thenReturn(empId);
        return employee;
    }

    private MultipartFile upload() {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getSize()).thenReturn(1L);
        return file;
    }

    private record TestContext(FileService service, BoardPostRepository boardPosts, NoticeRepository notices) {
    }
}
