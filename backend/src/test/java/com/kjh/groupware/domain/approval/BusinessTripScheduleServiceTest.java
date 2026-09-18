package com.kjh.groupware.domain.approval;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class BusinessTripScheduleServiceTest {
    private final ApprovalDocumentRepository documents = mock(ApprovalDocumentRepository.class);
    private final ApprovalLineRepository lines = mock(ApprovalLineRepository.class);
    private final CurrentEmpProvider current = mock(CurrentEmpProvider.class);
    private final Emp owner = mock(Emp.class);
    private final BusinessTripScheduleService service = new BusinessTripScheduleService(documents, lines, current, new ObjectMapper());

    @Test
    void returnsOnlyOwnApprovedUndeletedTripsOverlappingTheRequestedPeriod() {
        when(current.getCurrentEmp()).thenReturn(owner);
        doReturn(List.of(
            trip(1L, "APPROVED", "N", "2026-08-30", "2026-09-02"),
            trip(2L, "APPROVED", "N", "2026-09-30", "2026-10-02"),
            trip(3L, "IN_PROGRESS", "N", "2026-09-01", "2026-09-02"),
            trip(4L, "REJECTED", "N", "2026-09-01", "2026-09-02"),
            trip(5L, "CANCELED", "N", "2026-09-01", "2026-09-02"),
            trip(6L, "APPROVED", "Y", "2026-09-01", "2026-09-02"),
            trip(7L, "APPROVED", "N", "2026-08-01", "2026-08-31"),
            trip(8L, "APPROVED", "N", "2026-10-01", "2026-10-02"),
            trip(9L, "APPROVED", "N", "2026-09-15", "2026-09-15")
        )).when(documents).findByRequesterAndTemplateCodeIn(owner, List.of("BUSINESS_TRIP"));
        var result = service.mySchedules(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30));
        assertThat(result).extracting(BusinessTripScheduleService.Schedule::approvalId).containsExactly(1L, 9L, 2L);
        assertThat(result.getFirst().destination()).isEqualTo("부산");
        verify(documents).findByRequesterAndTemplateCodeIn(owner, List.of("BUSINESS_TRIP"));
        // Calendar projection must not read/mark document details or depend on requestedAt.
        verifyNoMoreInteractions(documents);
    }

    @Test
    void malformedLegacyDocumentsDoNotHideValidTrips() {
        when(current.getCurrentEmp()).thenReturn(owner);
        var malformed = trip(1L, "APPROVED", "N", "2026-09-01", "2026-09-02");
        when(malformed.getFormDataJson()).thenReturn("{bad json");
        var empty = trip(2L, "APPROVED", "N", "2026-09-01", "2026-09-02");
        when(empty.getFormDataJson()).thenReturn("null");
        doReturn(List.of(
            malformed, empty,
            trip(3L, "APPROVED", "N", "2026-02-30", "2026-09-02"),
            trip(4L, "APPROVED", "N", "2026-09-03", "2026-09-02"),
            trip(5L, "APPROVED", "N", "2026-09-01", "2026-09-02")
        )).when(documents).findByRequesterAndTemplateCodeIn(owner, List.of("BUSINESS_TRIP"));
        assertThat(service.mySchedules(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30)))
            .extracting(BusinessTripScheduleService.Schedule::approvalId).containsExactly(5L);
    }

    @Test
    void rejectsInvalidRangesBeforeQuerying() {
        assertThatThrownBy(() -> service.mySchedules(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 9, 1)))
            .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.mySchedules(null, LocalDate.of(2026, 9, 1)))
            .isInstanceOf(BusinessException.class);
        verifyNoInteractions(documents);
    }


    @Test
    void showsApprovedOrderWhileReceiptOrAllowanceApprovalIsStillPending() {
        when(current.getCurrentEmp()).thenReturn(owner);
        var document = trip(20L, "IN_PROGRESS", "N", "2026-09-01", "2026-09-02");
        var decision = mock(ApprovalLine.class);
        when(decision.isDecisionLine()).thenReturn(true);
        when(decision.getLineOrder()).thenReturn(1);
        when(decision.getStatus()).thenReturn(ApprovalLine.STATUS_APPROVED);
        var receiver = mock(ApprovalLine.class);
        when(receiver.isReceiver()).thenReturn(true);
        when(receiver.getLineOrder()).thenReturn(2);
        var allowance = mock(ApprovalLine.class);
        when(allowance.isDecisionLine()).thenReturn(true);
        when(allowance.getLineOrder()).thenReturn(3);
        when(allowance.getStatus()).thenReturn(ApprovalLine.STATUS_PENDING);
        when(lines.findByDocumentOrderByLineOrderAsc(document)).thenReturn(List.of(decision, receiver, allowance));
        when(documents.findByRequesterAndTemplateCodeIn(owner, List.of("BUSINESS_TRIP"))).thenReturn(List.of(document));
        assertThat(service.mySchedules(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30))).hasSize(1);
        when(decision.getStatus()).thenReturn(ApprovalLine.STATUS_PENDING);
        assertThat(service.mySchedules(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30))).isEmpty();
        when(lines.findByDocumentOrderByLineOrderAsc(document)).thenReturn(List.of(receiver));
        assertThat(service.mySchedules(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 30))).isEmpty();
    }

    private ApprovalDocument trip(Long id, String status, String deleted, String start, String end) {
        var document = mock(ApprovalDocument.class);
        when(document.getApprovalId()).thenReturn(id);
        when(document.getStatus()).thenReturn(status);
        when(document.getDeletedYn()).thenReturn(deleted);
        when(document.getTitle()).thenReturn("출장명령부");
        when(document.getFormDataJson()).thenReturn(String.format(
            "{\"fields\":{\"startDate\":\"%s\",\"endDate\":\"%s\",\"destination\":\"부산\"}}", start, end));
        return document;
    }
}
