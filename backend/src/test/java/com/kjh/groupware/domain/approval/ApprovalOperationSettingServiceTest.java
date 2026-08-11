package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.approval.dto.ApprovalOperationSettingResponse;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ApprovalOperationSettingServiceTest {

    private final ApprovalOperationSettingRepository settingRepository = mock(ApprovalOperationSettingRepository.class);
    private final ApprovalPermissionService permissionService = mock(ApprovalPermissionService.class);
    private final CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);
    private final EmpRepository empRepository = mock(EmpRepository.class);
    private final ApprovalOperationSettingService service = new ApprovalOperationSettingService(
        settingRepository,
        new ApprovalOperationProperties(72, 300000),
        permissionService,
        currentEmpProvider,
        empRepository
    );

    @Test
    void currentUsesConfiguredActiveLeaveReceiver() {
        Emp fallback = activeEmp(153L, "허인성");
        Emp configured = activeEmp(151L, "김종현");
        when(settingRepository.findBySettingKeyIn(org.mockito.ArgumentMatchers.anyList())).thenReturn(List.of(
            new ApprovalOperationSetting(ApprovalOperationSetting.KEY_LEAVE_DEFAULT_RECEIVER_EMP_ID, "151", "default receiver")
        ));
        when(empRepository.findActiveByLoginId("e7016")).thenReturn(Optional.of(fallback));
        when(empRepository.findById(151L)).thenReturn(Optional.of(configured));

        ApprovalOperationSettingResponse response = service.current();

        assertThat(response.leaveDefaultReceiverEmpId()).isEqualTo(151L);
        assertThat(response.leaveDefaultReceiverName()).isEqualTo("김종현");
        assertThat(response.fallbackLeaveDefaultReceiverEmpId()).isEqualTo(153L);
        assertThat(response.fallbackLeaveDefaultReceiverName()).isEqualTo("허인성");
    }

    @Test
    void currentFallsBackWhenConfiguredReceiverIsInactive() {
        Emp fallback = activeEmp(153L, "허인성");
        Emp inactive = activeEmp(151L, "김종현");
        ReflectionTestUtils.setField(inactive, "status", "INACTIVE");
        when(settingRepository.findBySettingKeyIn(org.mockito.ArgumentMatchers.anyList())).thenReturn(List.of(
            new ApprovalOperationSetting(ApprovalOperationSetting.KEY_LEAVE_DEFAULT_RECEIVER_EMP_ID, "151", "default receiver")
        ));
        when(empRepository.findActiveByLoginId("e7016")).thenReturn(Optional.of(fallback));
        when(empRepository.findById(151L)).thenReturn(Optional.of(inactive));

        ApprovalOperationSettingResponse response = service.current();

        assertThat(response.leaveDefaultReceiverEmpId()).isEqualTo(153L);
        assertThat(response.leaveDefaultReceiverName()).isEqualTo("허인성");
    }

    private Emp activeEmp(Long id, String name) {
        try {
            java.lang.reflect.Constructor<Emp> constructor = Emp.class.getDeclaredConstructor();
            constructor.setAccessible(true);
            Emp emp = constructor.newInstance();
            ReflectionTestUtils.setField(emp, "empId", id);
            ReflectionTestUtils.setField(emp, "empNo", "E" + id);
            ReflectionTestUtils.setField(emp, "empName", name);
            ReflectionTestUtils.setField(emp, "roleCode", "USER");
            ReflectionTestUtils.setField(emp, "positionName", "Staff");
            ReflectionTestUtils.setField(emp, "status", "ACTIVE");
            ReflectionTestUtils.setField(emp, "accountStatus", "ACTIVE");
            ReflectionTestUtils.setField(emp, "useYn", "Y");
            return emp;
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
