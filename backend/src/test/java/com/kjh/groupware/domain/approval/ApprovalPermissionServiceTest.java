package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.approval.dto.ApprovalPermissionResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.global.exception.BusinessException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ApprovalPermissionServiceTest {

    @Test
    void nonHrLeaveAdminCannotUseGlobalAccessForSensitiveBirthLeave() {
        EmployeePermissionService employeePermissionService = mock(EmployeePermissionService.class);
        ApprovalPermissionService service = new ApprovalPermissionService(
            mock(ApprovalDelegationService.class),
            employeePermissionService
        );
        Emp requester = emp(1L);
        Emp leaveAdmin = emp(2L);
        ApprovalDocument document = sensitiveLeave(requester);
        when(employeePermissionService.hasPermission(leaveAdmin, EmployeePermissionService.LEAVE_ADMIN)).thenReturn(true);
        when(employeePermissionService.canAccessSensitiveLeave(leaveAdmin)).thenReturn(false);

        ApprovalPermissionResponse permissions = service.permissions(leaveAdmin, document, List.of());

        assertThat(permissions.canView()).isFalse();
        assertThat(permissions.canDownloadAttachment()).isFalse();
        assertThatThrownBy(() -> service.assertCanDownloadAttachment(leaveAdmin, document, List.of()))
            .isInstanceOfSatisfying(BusinessException.class, exception ->
                assertThat(exception.getCode()).isEqualTo("APPROVAL_FILE_DOWNLOAD_FORBIDDEN")
            );
    }

    @Test
    void hrLeaveAdminCanAccessSensitiveBirthLeaveAndRequesterKeepsOwnAccess() {
        EmployeePermissionService employeePermissionService = mock(EmployeePermissionService.class);
        ApprovalPermissionService service = new ApprovalPermissionService(
            mock(ApprovalDelegationService.class),
            employeePermissionService
        );
        Emp requester = emp(1L);
        Emp hrLeaveAdmin = emp(2L);
        ApprovalDocument document = sensitiveLeave(requester);
        when(employeePermissionService.hasPermission(hrLeaveAdmin, EmployeePermissionService.LEAVE_ADMIN)).thenReturn(true);
        when(employeePermissionService.canAccessSensitiveLeave(hrLeaveAdmin)).thenReturn(true);

        assertThat(service.permissions(hrLeaveAdmin, document, List.of()).canView()).isTrue();
        assertThat(service.permissions(hrLeaveAdmin, document, List.of()).canDownloadAttachment()).isTrue();
        assertThat(service.permissions(requester, document, List.of()).canView()).isTrue();
        assertThat(service.isSensitiveLeaveDocument(document)).isTrue();
    }

    private ApprovalDocument sensitiveLeave(Emp requester) {
        ApprovalDocument document = ApprovalDocument.builder()
            .title("배우자 출산휴가")
            .content("민감 휴가 문서")
            .templateCode(ApprovalLeaveUsageService.LEAVE_TEMPLATE_CODE)
            .templateVersion(1)
            .formDataJson("{\"fields\":{\"leaveSelectionsJson\":\"[{\\\"date\\\":\\\"2026-08-21\\\",\\\"type\\\":\\\"배우자 출산휴가\\\"}]\"}}")
            .requester(requester)
            .build();
        ReflectionTestUtils.setField(document, "approvalId", 10L);
        return document;
    }

    private Emp emp(Long empId) {
        Emp emp = mock(Emp.class);
        when(emp.getEmpId()).thenReturn(empId);
        return emp;
    }
}
