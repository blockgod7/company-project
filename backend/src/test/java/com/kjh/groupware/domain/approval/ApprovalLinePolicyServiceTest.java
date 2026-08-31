package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.approval.dto.ApprovalRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.exception.BusinessException;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ApprovalLinePolicyServiceTest {

    private final ApprovalLineRepository lineRepository = mock(ApprovalLineRepository.class);
    private final EmpRepository empRepository = mock(EmpRepository.class);
    private final ApprovalDelegationService delegationService = mock(ApprovalDelegationService.class);
    private final ApprovalReminderService reminderService = mock(ApprovalReminderService.class);

    private ApprovalLinePolicyService service;
    private Emp requester;

    @BeforeEach
    void setUp() {
        requester = activeEmp(1L, "Requester");
        Emp receiver = activeEmp(2L, "Receiver");
        when(empRepository.findById(1L)).thenReturn(Optional.of(requester));
        when(empRepository.findById(2L)).thenReturn(Optional.of(receiver));
        service = new ApprovalLinePolicyService(lineRepository, empRepository, delegationService, reminderService);
    }

    @Test
    void receiverCannotAlsoBeReference() {
        ApprovalRequest request = request(List.of(2L), List.of(2L));

        assertThatThrownBy(() -> service.validateLineSelection(requester, request, false))
            .isInstanceOfSatisfying(BusinessException.class, ex ->
                assertThat(ex.getCode()).isEqualTo("APPROVAL_INVALID_LINE")
            );
    }

    @Test
    void requesterMayRemainReceiverWhenSubmittingOwnDocument() {
        ApprovalRequest request = request(List.of(1L), List.of());

        assertThatCode(() -> service.validateLineSelection(requester, request, false))
            .doesNotThrowAnyException();
    }

    private ApprovalRequest request(List<Long> receiverEmpIds, List<Long> referenceEmpIds) {
        return new ApprovalRequest(
            "Title",
            "Content",
            "DRAFT",
            "{}",
            "NORMAL",
            List.of(),
            List.of(),
            receiverEmpIds,
            referenceEmpIds,
            List.of(),
            true
        );
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
