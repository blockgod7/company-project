package com.kjh.groupware.domain.work;

import static org.assertj.core.api.Assertions.assertThat;
import com.kjh.groupware.domain.emp.Emp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class WorkRequestEntryTimingTest {
    private WorkRequestEntry work(LocalTime start, LocalTime end) {
        Emp employee = Emp.pending("QA", "검증 직원", "MALE", null, null, null, null, "반장", null, null,
            LocalDate.of(2020, 1, 1), "REGULAR", null, null);
        return new WorkRequestEntry(null, employee, employee, "SPECIAL_NIGHT", LocalDate.of(2026, 8, 29),
            start, end, 240, "시간 경계 검증", true);
    }

    @Test
    void overnightApprovalDoesNotCompleteAtMidnight() {
        WorkRequestEntry entry = work(LocalTime.of(22, 0), LocalTime.of(2, 0));
        entry.approve(LocalDateTime.of(2026, 8, 30, 0, 5));
        assertThat(entry.getStatus()).isEqualTo(WorkRequestEntry.PLANNED);
        entry.complete(LocalDateTime.of(2026, 8, 30, 1, 59, 59));
        assertThat(entry.getStatus()).isEqualTo(WorkRequestEntry.PLANNED);
        entry.complete(LocalDateTime.of(2026, 8, 30, 2, 0));
        assertThat(entry.getStatus()).isEqualTo(WorkRequestEntry.COMPLETED);
    }

    @Test
    void sameDayWorkCompletesAtExactEndTime() {
        WorkRequestEntry entry = work(LocalTime.of(8, 0), LocalTime.of(12, 0));
        entry.approve(LocalDateTime.of(2026, 8, 29, 11, 59));
        assertThat(entry.getStatus()).isEqualTo(WorkRequestEntry.PLANNED);
        entry.complete(LocalDateTime.of(2026, 8, 29, 12, 0));
        assertThat(entry.getStatus()).isEqualTo(WorkRequestEntry.COMPLETED);
    }

    @Test
    void equalTimesMeanTwentyFourHoursAndMidnightEndMeansNextDay() {
        assertThat(work(LocalTime.of(8, 0), LocalTime.of(8, 0)).scheduledEnd())
            .isEqualTo(LocalDateTime.of(2026, 8, 30, 8, 0));
        assertThat(work(LocalTime.of(20, 0), LocalTime.MIDNIGHT).scheduledEnd())
            .isEqualTo(LocalDateTime.of(2026, 8, 30, 0, 0));
    }

    @Test
    void pendingChangePreventsCompletionAndRejectionRestoresAccordingToEndTime() {
        WorkRequestEntry entry = work(LocalTime.of(22, 0), LocalTime.of(2, 0));
        entry.approve(LocalDateTime.of(2026, 8, 29, 21, 0));
        entry.markCancelPending();
        entry.complete(LocalDateTime.of(2026, 8, 30, 2, 0));
        assertThat(entry.getStatus()).isEqualTo(WorkRequestEntry.CANCEL_PENDING);
        entry.restoreAfterChange(LocalDateTime.of(2026, 8, 30, 0, 5));
        assertThat(entry.getStatus()).isEqualTo(WorkRequestEntry.PLANNED);
        entry.markCancelPending();
        entry.restoreAfterChange(LocalDateTime.of(2026, 8, 30, 2, 0));
        assertThat(entry.getStatus()).isEqualTo(WorkRequestEntry.COMPLETED);
    }
}
