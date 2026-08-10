package com.kjh.groupware.domain.approval;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ApprovalHolidayOfficialProvider {
    private final KoreanPublicHolidayClient publicHolidayClient;

    public ApprovalHolidayOfficialCalendar.OfficialYear require(int year) {
        return ApprovalHolidayOfficialCalendar.find(year).orElseGet(() -> publicHolidayClient.fetch(year));
    }

    public ApprovalHolidayOfficialCalendar.OfficialYear fetchExternal(int year) {
        return publicHolidayClient.fetch(year);
    }

    public boolean isExternalConfigured() {
        return publicHolidayClient.isConfigured();
    }
}
