package com.kjh.groupware.domain.approval.dto;

import com.kjh.groupware.domain.approval.ScheduledJobRun;
import java.time.LocalDateTime;

public record ScheduledJobStatusResponse(
    String jobName, String status, LocalDateTime lastStartedAt, LocalDateTime lastSucceededAt,
    LocalDateTime lastFailedAt, Long durationMs, String message
) {
    public static ScheduledJobStatusResponse from(ScheduledJobRun run) {
        return new ScheduledJobStatusResponse(run.getJobName(), run.getStatus(), run.getLastStartedAt(),
            run.getLastSucceededAt(), run.getLastFailedAt(), run.getDurationMs(), run.getMessage());
    }
}
