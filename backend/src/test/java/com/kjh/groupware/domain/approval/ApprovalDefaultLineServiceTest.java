package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kjh.groupware.domain.approval.dto.ApprovalDefaultLineRenameRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalDefaultLineRequest;
import com.kjh.groupware.domain.approval.dto.ApprovalDefaultLineResponse;
import com.kjh.groupware.domain.approval.dto.ApprovalDefaultLineStepRequest;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class ApprovalDefaultLineServiceTest {

    private static final String RECENT_LINE_NAME = "\uCD5C\uADFC \uC0AC\uC6A9 \uACB0\uC7AC\uC120";

    private final ApprovalDefaultLineRepository defaultLineRepository = mock(ApprovalDefaultLineRepository.class);
    private final ApprovalDefaultLineStepRepository stepRepository = mock(ApprovalDefaultLineStepRepository.class);
    private final EmpRepository empRepository = mock(EmpRepository.class);
    private final ApprovalTemplateRepository templateRepository = mock(ApprovalTemplateRepository.class);
    private final CurrentEmpProvider currentEmpProvider = mock(CurrentEmpProvider.class);

    private ApprovalDefaultLineService service;
    private Emp owner;
    private Emp approver;

    @BeforeEach
    void setUp() {
        owner = activeEmp(1L, "Owner");
        approver = activeEmp(2L, "Approver");
        when(currentEmpProvider.getCurrentEmp()).thenReturn(owner);
        when(empRepository.findById(2L)).thenReturn(Optional.of(approver));
        service = new ApprovalDefaultLineService(
            defaultLineRepository,
            stepRepository,
            empRepository,
            templateRepository,
            currentEmpProvider
        );
    }

    @Test
    void recentApprovalLineReusesExistingRowAndReplacesSteps() {
        ApprovalDefaultLine existing = personalLine(10L, RECENT_LINE_NAME);
        when(defaultLineRepository.findByOwnerAndDefaultTypeAndLineNameAndDeletedYnOrderBySortOrderAscDefaultLineIdDesc(
            owner,
            ApprovalDefaultLine.TYPE_PERSONAL,
            RECENT_LINE_NAME,
            "N"
        )).thenReturn(List.of(existing));
        when(stepRepository.findByDefaultLineAndDeletedYnOrderByStepOrderAscDefaultLineStepIdAsc(existing, "N"))
            .thenReturn(List.of());

        ApprovalDefaultLineResponse response = service.savePersonal(request(RECENT_LINE_NAME));

        assertThat(response.defaultLineId()).isEqualTo(10L);
        verify(defaultLineRepository, never()).save(any(ApprovalDefaultLine.class));
        verify(stepRepository).deleteByDefaultLine(existing);
        verify(stepRepository).save(any(ApprovalDefaultLineStep.class));
    }

    @Test
    void renamePersonalOnlyRequiresLineName() {
        ApprovalDefaultLine line = personalLine(20L, "Manager final");
        when(defaultLineRepository.findById(20L)).thenReturn(Optional.of(line));
        when(stepRepository.findByDefaultLineAndDeletedYnOrderByStepOrderAscDefaultLineStepIdAsc(line, "N"))
            .thenReturn(List.of());

        ApprovalDefaultLineResponse response = service.renamePersonal(20L, new ApprovalDefaultLineRenameRequest("CEO final"));

        assertThat(response.lineName()).isEqualTo("CEO final");
    }

    private ApprovalDefaultLineRequest request(String lineName) {
        return new ApprovalDefaultLineRequest(
            lineName,
            null,
            List.of(new ApprovalDefaultLineStepRequest(1, 2L, ApprovalLine.TYPE_APPROVAL, true))
        );
    }

    private ApprovalDefaultLine personalLine(Long id, String lineName) {
        ApprovalDefaultLine line = ApprovalDefaultLine.builder()
            .owner(owner)
            .lineName(lineName)
            .defaultType(ApprovalDefaultLine.TYPE_PERSONAL)
            .activeYn("Y")
            .sortOrder(0)
            .deletedYn("N")
            .build();
        ReflectionTestUtils.setField(line, "defaultLineId", id);
        return line;
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
            ReflectionTestUtils.setField(emp, "useYn", "Y");
            return emp;
        } catch (ReflectiveOperationException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
