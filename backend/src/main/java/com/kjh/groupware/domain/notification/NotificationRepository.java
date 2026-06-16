package com.kjh.groupware.domain.notification;

import com.kjh.groupware.domain.emp.Emp;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByEmpOrderByNotificationIdDesc(Emp emp);

    List<Notification> findByEmpAndReadYnOrderByNotificationIdDesc(Emp emp, String readYn);
}
