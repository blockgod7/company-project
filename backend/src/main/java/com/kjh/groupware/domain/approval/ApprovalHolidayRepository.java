package com.kjh.groupware.domain.approval;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApprovalHolidayRepository extends JpaRepository<ApprovalHoliday, Long> {
    Optional<ApprovalHoliday> findByHolidayDate(LocalDate holidayDate);
    Optional<ApprovalHoliday> findByHolidayDateAndActiveYn(LocalDate holidayDate, String activeYn);
    Optional<ApprovalHoliday> findFirstByActiveYnAndSourceTypeAndRepeatTypeAndRepeatMonthAndRepeatDay(
        String activeYn,
        String sourceType,
        String repeatType,
        Integer repeatMonth,
        Integer repeatDay
    );
    List<ApprovalHoliday> findByActiveYnAndHolidayDateBetweenOrderByHolidayDateAsc(String activeYn, LocalDate from, LocalDate to);
    List<ApprovalHoliday> findByActiveYnOrderByHolidayDateAsc(String activeYn);
    List<ApprovalHoliday> findAllByOrderByHolidayDateAsc();
}
