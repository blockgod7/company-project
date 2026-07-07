package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.notification.Notification;
import com.kjh.groupware.domain.notification.NotificationRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class NotificationGlobalSearchProvider implements GlobalSearchProvider {

    private final NotificationRepository notificationRepository;

    @Override
    public int order() {
        return 60;
    }

    @Override
    public GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp) {
        Page<Notification> page = notificationRepository.searchMine(currentEmp, keyword, PageRequest.of(0, limit));
        List<GlobalSearchItemResponse> items = page.getContent().stream()
            .map(notification -> new GlobalSearchItemResponse(
                "NOTIFICATION",
                notification.getNotificationId(),
                notification.getTargetId(),
                "notifications",
                notification.getTitle(),
                GlobalSearchText.snippet(notification.getMessage()),
                GlobalSearchText.join(notification.getTargetType(), notification.getNotificationStatus()),
                "Y".equals(notification.getReadYn()) ? List.of("읽음") : List.of("미읽음"),
                notification.getCreatedAt()
            ))
            .toList();
        return new GlobalSearchGroupResponse("notifications", "알림", page.getTotalElements(), items);
    }
}
