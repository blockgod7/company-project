package com.kjh.groupware.domain.work;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.approval.*;
import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.domain.emp.*;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;

class WorkRequestServiceTest {
    private final WorkRequestEntryRepository entries = mock(WorkRequestEntryRepository.class);
    private final WorkRequestChangeRepository changes = mock(WorkRequestChangeRepository.class);
    private final EmpRepository employees = mock(EmpRepository.class);
    private final ApprovalHolidayRepository holidays = mock(ApprovalHolidayRepository.class);
    private final EmployeePermissionService permissions = mock(EmployeePermissionService.class);
    private final CurrentEmpProvider currentEmp = mock(CurrentEmpProvider.class);
    private final CompTimeLedgerService compTime = mock(CompTimeLedgerService.class);
    private WorkRequestService service;

    @BeforeEach
    void setUp() {
        service = new WorkRequestService(entries, changes, employees, holidays, permissions, currentEmp, compTime, new ObjectMapper());
    }

    @Test
    void createsCombinedSpecialNightOvertimeEntryWithCompTimeForFieldEmployee() {
        Emp worker = employee(100L, "100", "현장직", "반장");
        ApprovalDocument document = document(worker, WorkRequestService.TEMPLATE, """
            {"fields":{"workEntriesJson":"[{\\\"empId\\\":100,\\\"workType\\\":\\\"SPECIAL_NIGHT_OVERTIME\\\",\\\"workDate\\\":\\\"2026-08-22\\\",\\\"startTime\\\":\\\"20:00\\\",\\\"endTime\\\":\\\"00:00\\\",\\\"workContent\\\":\\\"특근 야간 잔업\\\",\\\"compTime\\\":true}]"}}
            """);
        when(employees.findById(100L)).thenReturn(Optional.of(worker));

        service.prepareSubmission(document);

        ArgumentCaptor<WorkRequestEntry> captor = ArgumentCaptor.forClass(WorkRequestEntry.class);
        verify(entries).save(captor.capture());
        assertThat(captor.getValue().getWorkMinutes()).isEqualTo(240);
        assertThat(captor.getValue().getWorkType()).isEqualTo("SPECIAL_NIGHT_OVERTIME");
        assertThat(captor.getValue().getCompTimeYn()).isEqualTo("Y");
    }

    @Test
    void rejectsCompTimeWhenSpecialWorkIsShorterThanFourHours() {
        Emp worker = employee(105L, "105", "현장직", "반장");
        ApprovalDocument document = document(worker, WorkRequestService.TEMPLATE, """
            {"fields":{"workEntriesJson":"[{\\"empId\\":105,\\"workType\\":\\"SPECIAL\\",\\"workDate\\":\\"2026-08-22\\",\\"startTime\\":\\"08:30\\",\\"endTime\\":\\"12:00\\",\\"workContent\\":\\"3시간 30분 특근\\",\\"compTime\\":true}]"}}
            """);
        when(employees.findById(105L)).thenReturn(Optional.of(worker));

        assertThatThrownBy(() -> service.prepareSubmission(document))
            .isInstanceOfSatisfying(BusinessException.class,
                error -> assertThat(error.getCode()).isEqualTo("COMP_TIME_MINIMUM_NOT_MET"));
        verify(entries, never()).save(any());
    }

    @Test
    void normalWorkRequestRequiresOneCommonDateForEveryWorkerRow() {
        Emp worker = employee(110L, "110", "현장직", "반장");
        ApprovalDocument document = document(worker, WorkRequestService.TEMPLATE, """
            {"fields":{"workEntriesJson":"[{\\\"empId\\\":110,\\\"workType\\\":\\\"OVERTIME\\\",\\\"workDate\\\":\\\"2026-08-21\\\",\\\"startTime\\\":\\\"18:00\\\",\\\"endTime\\\":\\\"20:00\\\",\\\"workContent\\\":\\\"첫째 날\\\",\\\"compTime\\\":false},{\\\"empId\\\":110,\\\"workType\\\":\\\"OVERTIME\\\",\\\"workDate\\\":\\\"2026-08-22\\\",\\\"startTime\\\":\\\"20:00\\\",\\\"endTime\\\":\\\"22:00\\\",\\\"workContent\\\":\\\"둘째 날\\\",\\\"compTime\\\":false}]"}}
            """);
        when(employees.findById(110L)).thenReturn(Optional.of(worker));

        assertThatThrownBy(() -> service.prepareSubmission(document)).isInstanceOf(BusinessException.class);
        verify(entries, times(1)).save(any());
    }

    @Test
    void managementEmployeeCannotRequestOvertime() {
        Emp manager = employee(200L, "200", "관리직", "과장");
        ApprovalDocument document = document(manager, WorkRequestService.TEMPLATE, """
            {"fields":{"workEntriesJson":"[{\\\"empId\\\":200,\\\"workType\\\":\\\"OVERTIME\\\",\\\"workDate\\\":\\\"2026-08-21\\\",\\\"startTime\\\":\\\"18:00\\\",\\\"endTime\\\":\\\"20:00\\\",\\\"workContent\\\":\\\"잔업\\\",\\\"compTime\\\":false}]"}}
            """);
        when(employees.findById(200L)).thenReturn(Optional.of(manager));

        assertThatThrownBy(() -> service.prepareSubmission(document)).isInstanceOf(BusinessException.class);
        verify(entries, never()).save(any());
    }

    @ParameterizedTest
    @ValueSource(strings = {"반장", "과장"})
    void normalWorkRequestCreatesEmergencyCallForFieldAndManagementEmployees(String position) {
        Emp worker = employee(210L, "210", "비상호출 근무자", position);
        ApprovalDocument document = document(worker, WorkRequestService.TEMPLATE, """
            {"fields":{"workEntriesJson":[{"empId":210,"workType":"EMERGENCY_CALL",
            "workDate":"2026-08-21","startTime":"18:00","endTime":"20:00",
            "workContent":"비상호출","compTime":false}]}}
            """);
        when(employees.findById(210L)).thenReturn(Optional.of(worker));

        service.prepareSubmission(document);

        ArgumentCaptor<WorkRequestEntry> captor = ArgumentCaptor.forClass(WorkRequestEntry.class);
        verify(entries).save(captor.capture());
        assertThat(captor.getValue().getWorkType()).isEqualTo("EMERGENCY_CALL");
        assertThat(captor.getValue().getWorkMinutes()).isEqualTo(120);
        assertThat(captor.getValue().getCompTimeYn()).isEqualTo("N");
        assertThat(captor.getValue().getStatus()).isEqualTo(WorkRequestEntry.PENDING);
    }

    @ParameterizedTest
    @ValueSource(strings = {"EMERGENCY_CALL_OVERTIME", "SPECIAL_EMERGENCY_CALL", "EMERGENCY_CALL_NIGHT", "UNKNOWN"})
    void normalWorkRequestRejectsCombinedEmergencyAndUnknownTypes(String workType) {
        Emp worker = employee(211L, "211", "현장직", "반장");
        ApprovalDocument document = document(worker, WorkRequestService.TEMPLATE, """
            {"fields":{"workEntriesJson":[{"empId":211,"workType":"%s",
            "workDate":"2026-08-22","startTime":"08:00","endTime":"12:00",
            "workContent":"잘못된 근무 구분","compTime":false}]}}
            """.formatted(workType));
        when(employees.findById(211L)).thenReturn(Optional.of(worker));

        assertThatThrownBy(() -> service.prepareSubmission(document))
            .isInstanceOfSatisfying(BusinessException.class,
                error -> assertThat(error.getCode()).isEqualTo("WORK_TYPE_INVALID"));
        verify(entries, never()).save(any());
    }

    @Test
    void emergencyCallInNormalWorkRequestCannotGrantCompTime() {
        Emp worker = employee(212L, "212", "현장직", "반장");
        ApprovalDocument document = document(worker, WorkRequestService.TEMPLATE, """
            {"fields":{"workEntriesJson":[{"empId":212,"workType":"EMERGENCY_CALL",
            "workDate":"2026-08-22","startTime":"08:00","endTime":"12:00",
            "workContent":"비상호출","compTime":true}]}}
            """);
        when(employees.findById(212L)).thenReturn(Optional.of(worker));

        assertThatThrownBy(() -> service.prepareSubmission(document))
            .isInstanceOfSatisfying(BusinessException.class,
                error -> assertThat(error.getCode()).isEqualTo("COMP_TIME_SPECIAL_ONLY"));
        verify(entries, never()).save(any());
    }

    @Test
    void emergencyCallTemplateCreatesEmergencyEntry() {
        Emp worker = employee(220L, "220", "현장직", "반장");
        ApprovalDocument document = document(worker, WorkRequestService.EMERGENCY_TEMPLATE, """
            {"fields":{"workEntriesJson":"[{\\\"empId\\\":220,\\\"workType\\\":\\\"EMERGENCY_CALL\\\",\\\"workDate\\\":\\\"2026-08-21\\\",\\\"startTime\\\":\\\"18:00\\\",\\\"endTime\\\":\\\"20:00\\\",\\\"workContent\\\":\\\"비상호출\\\",\\\"compTime\\\":false}]"}}
            """);
        when(employees.findById(220L)).thenReturn(Optional.of(worker));

        service.prepareSubmission(document);

        ArgumentCaptor<WorkRequestEntry> captor = ArgumentCaptor.forClass(WorkRequestEntry.class);
        verify(entries).save(captor.capture());
        assertThat(captor.getValue().getWorkType()).isEqualTo("EMERGENCY_CALL");
    }

    @Test
    void delegatedCandidatesContainOnlyExactDepartment() {
        Dept processing = mock(Dept.class);
        Dept forming = mock(Dept.class);
        when(processing.getDeptId()).thenReturn(10L);
        when(processing.getDeptName()).thenReturn("모빌리티 - 가공");
        when(forming.getDeptId()).thenReturn(11L);
        Emp actor = activeEmployeeInDept(230L, "230", "가공 관리자", processing);
        Emp sameDept = activeEmployeeInDept(231L, "231", "가공 직원", processing);
        Emp otherDept = activeEmployeeInDept(232L, "232", "성형 직원", forming);
        when(currentEmp.getCurrentEmp()).thenReturn(actor);
        when(permissions.hasPermission(actor, EmployeePermissionService.WORK_REQUEST_DELEGATE)).thenReturn(true);
        when(employees.findAllEmployeesForManagement()).thenReturn(List.of(otherDept, sameDept, actor));

        var candidates = service.candidates();

        assertThat(candidates).extracting("empId").containsExactly(230L, 231L);
    }

    @Test
    void finalApprovalCompletesPastWorkAndRequestsCompCredit() {
        Emp worker = employee(300L, "300", "과거근무", "반장");
        ApprovalDocument document = document(worker, WorkRequestService.TEMPLATE, "{}");
        WorkRequestEntry entry = new WorkRequestEntry(document, worker, worker, "SPECIAL", LocalDate.now().minusDays(1),
            java.time.LocalTime.of(8, 0), java.time.LocalTime.of(13, 0), 300, "완료", true);
        when(entries.findByApprovalOrderByWorkEntryIdAsc(document)).thenReturn(List.of(entry));

        service.onFinalApproval(document);

        assertThat(entry.getStatus()).isEqualTo(WorkRequestEntry.COMPLETED);
        verify(compTime).grantFromCompletedWork(entry);
    }

    @Test
    void schedulerDoesNotGrantOvernightWorkBeforeItsEnd() {
        Emp worker = employee(400L, "400", "야간 검증", "반장");
        ApprovalDocument document = document(worker, WorkRequestService.TEMPLATE, "{}");
        LocalDate date = LocalDate.of(2026, 8, 29);
        WorkRequestEntry entry = new WorkRequestEntry(document, worker, worker, "SPECIAL_NIGHT", date,
            java.time.LocalTime.of(22, 0), java.time.LocalTime.of(2, 0), 240, "야간", true);
        entry.approve(date.atTime(21, 0));
        when(entries.dueForCompletion(date.plusDays(1))).thenReturn(List.of(entry));

        service.completePastSchedules(date.plusDays(1).atTime(0, 5));
        verify(compTime, never()).grantFromCompletedWork(any());
        assertThat(entry.getStatus()).isEqualTo(WorkRequestEntry.PLANNED);
        service.completePastSchedules(date.plusDays(1).atTime(2, 0));
        verify(compTime).grantFromCompletedWork(entry);
    }

    @Test
    void changeRequestRejectsShortCompTimeBeforeMarkingSourcePending() {
        Emp worker = employee(401L, "401", "변경 검증", "반장");
        LocalDate date = LocalDate.now(java.time.ZoneId.of("Asia/Seoul"))
            .with(java.time.temporal.TemporalAdjusters.next(java.time.DayOfWeek.SATURDAY));
        WorkRequestEntry source = new WorkRequestEntry(null, worker, worker, "SPECIAL", date,
            java.time.LocalTime.of(8, 0), java.time.LocalTime.of(12, 0), 240, "특근", true);
        source.approve(date.minusDays(1).atStartOfDay());
        when(entries.findByIdForUpdate(10L)).thenReturn(Optional.of(source));
        ApprovalDocument change = document(worker, WorkRequestService.CHANGE_TEMPLATE, """
            {"fields":{"workChangesJson":[{"sourceWorkEntryId":10,"actionType":"CHANGE",
            "reason":"시간 변경","newWorkDate":"%s","newStartTime":"08:00","newEndTime":"11:59",
            "newWorkContent":"단축 근무","newCompTime":true}]}}
            """.formatted(date));

        assertThatThrownBy(() -> service.prepareSubmission(change))
            .isInstanceOfSatisfying(BusinessException.class,
                error -> assertThat(error.getCode()).isEqualTo("COMP_TIME_MINIMUM_NOT_MET"));
        assertThat(source.getStatus()).isEqualTo(WorkRequestEntry.PLANNED);
        verify(changes, never()).save(any());
    }

    private Emp employee(Long id, String no, String name, String position) {
        Emp employee = Emp.pending(no, name, "MALE", null, null, null, null, position, null, null,
            LocalDate.of(2020, 1, 1), "REGULAR", null, null);
        ReflectionTestUtils.setField(employee, "empId", id);
        return employee;
    }

    private Emp activeEmployeeInDept(Long id, String no, String name, Dept dept) {
        Emp employee = employee(id, no, name, "반장");
        ReflectionTestUtils.setField(employee, "dept", dept);
        ReflectionTestUtils.setField(employee, "status", "ACTIVE");
        ReflectionTestUtils.setField(employee, "useYn", "Y");
        return employee;
    }

    private ApprovalDocument document(Emp requester, String template, String formJson) {
        ApprovalDocument document = mock(ApprovalDocument.class);
        when(document.getRequester()).thenReturn(requester);
        when(document.getTemplateCode()).thenReturn(template);
        when(document.getFormDataJson()).thenReturn(formJson);
        return document;
    }
}
