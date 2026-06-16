package com.kjh.groupware.domain.notification;

import com.kjh.groupware.domain.notification.dto.NotificationRequest;
import com.kjh.groupware.domain.notification.dto.NotificationResponse;
import com.kjh.groupware.global.response.ApiResponse;
import com.kjh.groupware.global.response.PageResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ApiResponse<PageResponse<NotificationResponse>> findMine(
        @RequestParam(required = false) String readYn,
        @RequestParam(required = false, defaultValue = "false") Boolean unreadOnly,
        @RequestParam(required = false, defaultValue = "0") int page,
        @RequestParam(required = false, defaultValue = "20") int size
    ) {
        String effectiveReadYn = readYn == null && Boolean.TRUE.equals(unreadOnly) ? "N" : readYn;
        return ApiResponse.ok(notificationService.findMine(effectiveReadYn, page, size));
    }

    @PostMapping
    public ApiResponse<NotificationResponse> create(@Valid @RequestBody NotificationRequest request) {
        return ApiResponse.ok(notificationService.create(request));
    }

    @PatchMapping("/{notificationId}/read")
    public ApiResponse<NotificationResponse> markRead(@PathVariable Long notificationId) {
        return ApiResponse.ok(notificationService.markRead(notificationId));
    }

    @PutMapping("/{notificationId}/read")
    public ApiResponse<NotificationResponse> putMarkRead(@PathVariable Long notificationId) {
        return ApiResponse.ok(notificationService.markRead(notificationId));
    }
}
