package com.kjh.groupware.domain.approval;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalLeaveExclusionRepository extends JpaRepository<ApprovalLeaveExclusion, Long> {
    boolean existsByDocumentAndLeaveDateAndActiveYn(ApprovalDocument document, LocalDate leaveDate, String activeYn);
    Optional<ApprovalLeaveExclusion> findByDocumentAndLeaveDate(ApprovalDocument document, LocalDate leaveDate);
    boolean existsByHoliday(ApprovalHoliday holiday);
    List<ApprovalLeaveExclusion> findByHolidayAndActiveYn(ApprovalHoliday holiday, String activeYn);
    List<ApprovalLeaveExclusion> findByDocumentOrderByLeaveDateAsc(ApprovalDocument document);
    List<ApprovalLeaveExclusion> findByDocumentRequesterOrderByLeaveDateAsc(com.kjh.groupware.domain.emp.Emp requester);
}
