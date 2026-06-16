package com.kjh.groupware.domain.notification;

import com.kjh.groupware.domain.emp.Emp;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByEmpOrderByNotificationIdDesc(Emp emp);

    List<Notification> findByEmpAndReadYnOrderByNotificationIdDesc(Emp emp, String readYn);

    Page<Notification> findByEmp(Emp emp, Pageable pageable);

    Page<Notification> findByEmpAndReadYn(Emp emp, String readYn, Pageable pageable);
}
