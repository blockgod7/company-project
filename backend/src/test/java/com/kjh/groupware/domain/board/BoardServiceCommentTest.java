package com.kjh.groupware.domain.board;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.board.dto.BoardCommentRequest;
import com.kjh.groupware.domain.board.dto.BoardCommentResponse;
import com.kjh.groupware.domain.dept.DeptRepository;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditActionType;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class BoardServiceCommentTest {

    @Test
    void writerCanUpdateOwnComment() {
        TestContext context = context(1L, "USER");
        BoardComment comment = comment(10L, 1L);
        when(context.comments.findById(10L)).thenReturn(Optional.of(comment));

        BoardCommentResponse response = context.service.updateComment(
            10L, new BoardCommentRequest("changed"), "127.0.0.1", "test"
        );

        verify(comment).update("changed");
        verify(context.audit).record(1L, AuditActionType.UPDATE, "board_comment", 10L, "127.0.0.1", "test");
        assertThat(response.commentId()).isEqualTo(10L);
    }

    @Test
    void otherEmployeeCannotUpdateComment() {
        TestContext context = context(2L, "USER");
        BoardComment comment = comment(10L, 1L);
        when(context.comments.findById(10L)).thenReturn(Optional.of(comment));

        assertThatThrownBy(() -> context.service.updateComment(
            10L, new BoardCommentRequest("changed"), "127.0.0.1", "test"
        )).isInstanceOfSatisfying(BusinessException.class, exception ->
            assertThat(exception.getCode()).isEqualTo("BOARD_POST_FORBIDDEN")
        );
        verify(comment, never()).update("changed");
    }

    private TestContext context(Long currentEmpId, String roleCode) {
        BoardCommentRepository comments = mock(BoardCommentRepository.class);
        CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
        AuditLogService audit = mock(AuditLogService.class);
        Emp currentEmp = mock(Emp.class);
        when(currentEmp.getEmpId()).thenReturn(currentEmpId);
        when(currentEmp.getRoleCode()).thenReturn(roleCode);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(currentEmp);
        BoardService service = new BoardService(
            mock(BoardRepository.class),
            mock(BoardPostRepository.class),
            comments,
            mock(BoardPostReadRepository.class),
            mock(DeptRepository.class),
            currentEmpProvider,
            audit,
            mock(NotificationService.class)
        );
        return new TestContext(service, comments, audit);
    }

    private BoardComment comment(Long commentId, Long writerEmpId) {
        BoardComment comment = mock(BoardComment.class);
        Emp writer = mock(Emp.class);
        when(writer.getEmpId()).thenReturn(writerEmpId);
        when(writer.getEmpName()).thenReturn("writer");
        when(comment.getCommentId()).thenReturn(commentId);
        when(comment.getWriter()).thenReturn(writer);
        when(comment.getContent()).thenReturn("changed");
        when(comment.getCreatedAt()).thenReturn(LocalDateTime.of(2026, 8, 10, 12, 0));
        when(comment.getDeletedYn()).thenReturn("N");
        return comment;
    }

    private record TestContext(BoardService service, BoardCommentRepository comments, AuditLogService audit) {
    }
}
