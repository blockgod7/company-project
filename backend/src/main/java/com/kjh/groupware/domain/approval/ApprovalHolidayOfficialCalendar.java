package com.kjh.groupware.domain.approval;

import com.kjh.groupware.global.exception.BusinessException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

final class ApprovalHolidayOfficialCalendar {

    private static final String BASIS_SOURCE_2026 = "https://astro.kasi.re.kr/life/post/calendardata";
    private static final String BASIS_SOURCE_2027 = "https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431";

    private static final Map<Integer, OfficialYear> YEARS = Map.of(
        2026, new OfficialYear("KASA-2026-AMENDED-2026-04-30", BASIS_SOURCE_2026, List.of(
            holiday(2026, 1, 1, "신정"),
            holiday(2026, 2, 16, "설날"), holiday(2026, 2, 17, "설날"), holiday(2026, 2, 18, "설날"),
            holiday(2026, 3, 1, "삼일절"), substitute(2026, 3, 2, "대체공휴일(삼일절)"),
            holiday(2026, 5, 1, "노동절"), holiday(2026, 5, 5, "어린이날"),
            holiday(2026, 5, 24, "부처님오신날"), substitute(2026, 5, 25, "대체공휴일(부처님오신날)"),
            holiday(2026, 6, 3, "전국동시지방선거"), holiday(2026, 6, 6, "현충일"),
            holiday(2026, 7, 17, "제헌절"), holiday(2026, 8, 15, "광복절"),
            substitute(2026, 8, 17, "대체공휴일(광복절)"),
            holiday(2026, 9, 24, "추석"), holiday(2026, 9, 25, "추석"), holiday(2026, 9, 26, "추석"),
            holiday(2026, 10, 3, "개천절"), substitute(2026, 10, 5, "대체공휴일(개천절)"),
            holiday(2026, 10, 9, "한글날"), holiday(2026, 12, 25, "성탄절")
        )),
        2027, new OfficialYear("KASA-2027-2026-06-29", BASIS_SOURCE_2027, List.of(
            holiday(2027, 1, 1, "신정"),
            holiday(2027, 2, 6, "설날"), holiday(2027, 2, 7, "설날"), holiday(2027, 2, 8, "설날"),
            substitute(2027, 2, 9, "대체공휴일(설날)"), holiday(2027, 3, 1, "삼일절"),
            holiday(2027, 5, 1, "노동절"), substitute(2027, 5, 3, "대체공휴일(노동절)"),
            holiday(2027, 5, 5, "어린이날"), holiday(2027, 5, 13, "부처님오신날"),
            holiday(2027, 6, 6, "현충일"), holiday(2027, 7, 17, "제헌절"),
            substitute(2027, 7, 19, "대체공휴일(제헌절)"), holiday(2027, 8, 15, "광복절"),
            substitute(2027, 8, 16, "대체공휴일(광복절)"),
            holiday(2027, 9, 14, "추석"), holiday(2027, 9, 15, "추석"), holiday(2027, 9, 16, "추석"),
            holiday(2027, 10, 3, "개천절"), substitute(2027, 10, 4, "대체공휴일(개천절)"),
            holiday(2027, 10, 9, "한글날"), substitute(2027, 10, 11, "대체공휴일(한글날)"),
            holiday(2027, 12, 25, "성탄절"), substitute(2027, 12, 27, "대체공휴일(성탄절)")
        ))
    );

    private ApprovalHolidayOfficialCalendar() {
    }

    static OfficialYear require(int year) {
        OfficialYear calendar = YEARS.get(year);
        if (calendar == null) {
            throw BusinessException.badRequest(
                "OFFICIAL_HOLIDAY_YEAR_UNAVAILABLE",
                year + "년 공식 월력요항이 시스템에 반영되지 않았습니다. 발표 자료 확인 후 기준표를 갱신해 주세요."
            );
        }
        return calendar;
    }

    static Optional<OfficialYear> find(int year) {
        return Optional.ofNullable(YEARS.get(year));
    }

    static Set<Integer> supportedYears() {
        return YEARS.keySet();
    }

    private static OfficialHoliday holiday(int year, int month, int day, String name) {
        return new OfficialHoliday(LocalDate.of(year, month, day), name, "PUBLIC_HOLIDAY");
    }

    private static OfficialHoliday substitute(int year, int month, int day, String name) {
        return new OfficialHoliday(LocalDate.of(year, month, day), name, "SUBSTITUTE_HOLIDAY");
    }

    record OfficialYear(String policyVersion, String basisSource, List<OfficialHoliday> holidays) {
    }

    record OfficialHoliday(LocalDate date, String name, String type) {
    }
}
