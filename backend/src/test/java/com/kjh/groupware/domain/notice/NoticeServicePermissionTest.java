package com.kjh.groupware.domain.notice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.notice.dto.NoticeRequest;
import com.kjh.groupware.domain.notification.NotificationService;
import com.kjh.groupware.global.audit.AuditLogService;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import org.junit.jupiter.api.Test;

class NoticeServicePermissionTest {

    @Test
    void createRejectsEmployeeWithoutNoticeWritePermission() {
        NoticeRepository noticeRepository = mock(NoticeRepository.class);
        CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
        EmployeePermissionService permissionService = mock(EmployeePermissionService.class);
        Emp employee = mock(Emp.class);
        when(currentEmpProvider.getCurrentEmp()).thenReturn(employee);
        doThrow(BusinessException.forbidden("NOTICE_WRITE_REQUIRED", "공지사항 작성 권한이 필요합니다."))
            .when(permissionService).requireNoticeWrite(employee);
        NoticeService service = new NoticeService(
            noticeRepository,
            mock(NoticeCommentRepository.class),
            mock(NoticeReadRepository.class),
            currentEmpProvider,
            permissionService,
            mock(AuditLogService.class),
            mock(NotificationService.class)
        );

        assertThatThrownBy(() -> service.create(new NoticeRequest("제목", "내용", false), "127.0.0.1", "test"))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getCode()).isEqualTo("NOTICE_WRITE_REQUIRED")
            );
        assertThatThrownBy(() -> service.update(1L, new NoticeRequest("수정", "내용", false), "127.0.0.1", "test"))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getCode()).isEqualTo("NOTICE_WRITE_REQUIRED")
            );
        assertThatThrownBy(() -> service.delete(1L, "127.0.0.1", "test"))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getCode()).isEqualTo("NOTICE_WRITE_REQUIRED")
            );
        verifyNoInteractions(noticeRepository);
    }
}
