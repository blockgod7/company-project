package com.kjh.groupware.domain.notification.dto;

import com.kjh.groupware.domain.notification.Notification;
import java.time.LocalDateTime;

public record NotificationResponse(
    Long notificationId,
    String title,
    String message,
    String targetType,
    Long targetId,
    boolean read,
    String readStatus,
    String notificationStatus,
    Integer retryCount,
    String lastErrorMessage,
    LocalDateTime readAt,
    LocalDateTime createdAt
) {

    public static NotificationResponse from(Notification notification) {
        return new NotificationResponse(
            notification.getNotificationId(),
            notification.getTitle(),
            notification.getMessage(),
            notification.getTargetType(),
            notification.getTargetId(),
            "Y".equals(notification.getReadYn()),
            "Y".equals(notification.getReadYn()) ? "READ" : "UNREAD",
            notification.getNotificationStatus(),
            notification.getRetryCount(),
            notification.getLastErrorMessage(),
            notification.getReadAt(),
            notification.getCreatedAt()
        );
    }
}
