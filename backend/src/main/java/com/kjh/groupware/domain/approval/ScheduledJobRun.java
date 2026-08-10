package com.kjh.groupware.domain.approval;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "scheduled_job_run")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ScheduledJobRun {
    @Id @Column(name = "job_name", length = 80) private String jobName;
    @Column(name = "status", nullable = false, length = 20) private String status;
    @Column(name = "last_started_at") private LocalDateTime lastStartedAt;
    @Column(name = "last_succeeded_at") private LocalDateTime lastSucceededAt;
    @Column(name = "last_failed_at") private LocalDateTime lastFailedAt;
    @Column(name = "duration_ms") private Long durationMs;
    @Column(name = "message", length = 1000) private String message;

    public ScheduledJobRun(String jobName) {
        this.jobName = jobName;
        this.status = "NEVER_RUN";
    }

    public void start() {
        status = "RUNNING";
        lastStartedAt = LocalDateTime.now();
        message = null;
    }

    public void succeed(String message) {
        status = "SUCCESS";
        lastSucceededAt = LocalDateTime.now();
        durationMs = duration();
        this.message = clean(message);
    }

    public void fail(String message) {
        status = "FAILED";
        lastFailedAt = LocalDateTime.now();
        durationMs = duration();
        this.message = clean(message);
    }

    public void skip(String message) {
        status = "SKIPPED";
        lastStartedAt = LocalDateTime.now();
        durationMs = 0L;
        this.message = clean(message);
    }

    private long duration() {
        return lastStartedAt == null ? 0L : Math.max(0L, java.time.Duration.between(lastStartedAt, LocalDateTime.now()).toMillis());
    }

    private String clean(String value) {
        if (value == null) return null;
        return value.length() <= 1000 ? value : value.substring(0, 1000);
    }
}
