package com.kjh.groupware.domain.notification;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.notification.dto.NotificationRequest;
import com.kjh.groupware.domain.notification.dto.NotificationResponse;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final EmpRepository empRepository;
    private final CurrentEmpProvider currentEmpProvider;

    @Transactional(readOnly = true)
    public List<NotificationResponse> findMine(Boolean unreadOnly) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        List<Notification> notifications = Boolean.TRUE.equals(unreadOnly)
            ? notificationRepository.findByEmpAndReadYnOrderByNotificationIdDesc(currentEmp, "N")
            : notificationRepository.findByEmpOrderByNotificationIdDesc(currentEmp);
        return notifications.stream().map(NotificationResponse::from).toList();
    }

    @Transactional
    public NotificationResponse create(NotificationRequest request) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        if (!"ADMIN".equals(currentEmp.getRoleCode())) {
            throw BusinessException.forbidden("ADMIN_REQUIRED", "Admin role is required");
        }
        return NotificationResponse.from(notifyEmp(request.empId(), request.title(), request.message(), request.targetType(), request.targetId()));
    }

    @Transactional
    public Notification notifyEmp(Long empId, String title, String message, String targetType, Long targetId) {
        Emp emp = empRepository.findById(empId)
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "Employee was not found"));
        Notification notification = Notification.builder()
            .emp(emp)
            .title(title)
            .message(message)
            .targetType(targetType)
            .targetId(targetId)
            .build();
        return notificationRepository.save(notification);
    }

    @Transactional
    public NotificationResponse markRead(Long notificationId) {
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        Notification notification = notificationRepository.findById(notificationId)
            .orElseThrow(() -> BusinessException.notFound("NOTIFICATION_NOT_FOUND", "Notification was not found"));
        if (!notification.getEmp().getEmpId().equals(currentEmp.getEmpId())) {
            throw BusinessException.forbidden("NOTIFICATION_FORBIDDEN", "Only the receiver can read this notification");
        }
        notification.markRead();
        return NotificationResponse.from(notification);
    }
}
