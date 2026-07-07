package com.kjh.groupware.domain.notification;

import com.kjh.groupware.domain.emp.Emp;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByEmpOrderByNotificationIdDesc(Emp emp);

    List<Notification> findByEmpAndReadYnOrderByNotificationIdDesc(Emp emp, String readYn);

    Page<Notification> findByEmp(Emp emp, Pageable pageable);

    Page<Notification> findByEmpAndReadYn(Emp emp, String readYn, Pageable pageable);

    @Query("""
        select n from Notification n
        where n.emp = :emp
          and (
            lower(n.title) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(n.message, '')) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(n.targetType, '')) like lower(concat('%', :keyword, '%'))
          )
        order by n.notificationId desc
        """)
    Page<Notification> searchMine(@Param("emp") Emp emp, @Param("keyword") String keyword, Pageable pageable);
}
