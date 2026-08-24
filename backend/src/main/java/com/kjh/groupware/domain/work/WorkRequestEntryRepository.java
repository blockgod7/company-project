package com.kjh.groupware.domain.work;

import com.kjh.groupware.domain.approval.ApprovalDocument;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkRequestEntryRepository extends JpaRepository<WorkRequestEntry, Long> {
    List<WorkRequestEntry> findByApprovalOrderByWorkEntryIdAsc(ApprovalDocument approval);
    void deleteByApproval(ApprovalDocument approval);

    @Query("select w from WorkRequestEntry w where w.emp.empId = :empId and w.status <> 'PENDING' and w.workDate between :from and :to order by w.workDate, w.startTime")
    List<WorkRequestEntry> calendar(@Param("empId") Long empId, @Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select w from WorkRequestEntry w where w.emp.empId = :empId and w.status = 'PLANNED' order by w.workDate, w.startTime")
    List<WorkRequestEntry> changeable(@Param("empId") Long empId);

    List<WorkRequestEntry> findByStatusOrderByWorkDateAscStartTimeAsc(String status);

    @Query("select w from WorkRequestEntry w where w.status = 'PLANNED' and w.workDate < :today order by w.workDate, w.workEntryId")
    List<WorkRequestEntry> dueForCompletion(@Param("today") LocalDate today);
}
