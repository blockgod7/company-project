package com.kjh.groupware.domain.notification;

import com.kjh.groupware.domain.emp.Emp;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "notification")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Long notificationId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "message", columnDefinition = "text")
    private String message;

    @Column(name = "target_type", length = 50)
    private String targetType;

    @Column(name = "target_id")
    private Long targetId;

    @Column(name = "read_yn", nullable = false, length = 1)
    private String readYn;

    @Column(name = "notification_status", nullable = false, length = 20)
    private String notificationStatus;

    @Column(name = "retry_count", nullable = false)
    private Integer retryCount;

    @Column(name = "last_error_message", columnDefinition = "text")
    private String lastErrorMessage;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Builder
    private Notification(Emp emp, String title, String message, String targetType, Long targetId) {
        this.emp = emp;
        this.title = title;
        this.message = message;
        this.targetType = targetType;
        this.targetId = targetId;
        this.readYn = "N";
        this.notificationStatus = "SENT";
        this.retryCount = 0;
    }

    public void markRead() {
        if (!"Y".equals(readYn)) {
            this.readYn = "Y";
            this.readAt = LocalDateTime.now();
        }
    }

    public void markSendFailed(String message) {
        this.notificationStatus = "FAILED";
        this.retryCount = retryCount == null ? 1 : retryCount + 1;
        this.lastErrorMessage = message;
    }
}
