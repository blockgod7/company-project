package com.kjh.groupware.domain.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record NotificationRequest(
    @NotNull Long empId,
    @NotBlank @Size(max = 200) String title,
    String message,
    @Size(max = 50) String targetType,
    Long targetId
) {
}
