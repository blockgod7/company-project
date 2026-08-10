package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.domain.notification.NotificationService;
import java.time.LocalDate;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ApprovalHolidayOpenApiMonitor {
    private final ApprovalHolidayOfficialProvider provider;
    private final EmpRepository empRepository;
    private final NotificationService notificationService;
    private final ScheduledJobStatusService scheduledJobStatusService;
    private volatile Integer lastNotifiedSuccessYear;
    private volatile String lastNotifiedFailure;

    @Scheduled(cron = "${app.approval.holiday-open-api.monitor-cron:0 0 7 1 7-12 *}", zone = "Asia/Seoul")
    public void checkNextYear() {
        String job = "official-holiday-open-api";
        if (!provider.isExternalConfigured()) {
            scheduledJobStatusService.skipped(job, "공공데이터 API 연동 미설정");
            return;
        }
        scheduledJobStatusService.start(job);
        int year = LocalDate.now().plusYears(1).getYear();
        try {
            ApprovalHolidayOfficialCalendar.OfficialYear calendar = provider.fetchExternal(year);
            if (!Integer.valueOf(year).equals(lastNotifiedSuccessYear)) {
                notifyManagers(
                    year + "년 공식 공휴일 확인 완료",
                    "공공데이터에서 " + calendar.holidays().size() + "건을 확인했습니다. 휴일관리에서 영향 미리보기 후 반영해 주세요."
                );
                lastNotifiedSuccessYear = year;
            }
            lastNotifiedFailure = null;
            scheduledJobStatusService.success(job, year + "년 " + calendar.holidays().size() + "건 확인");
        } catch (RuntimeException exception) {
            String failureKey = year + ":" + exception.getMessage();
            if (!failureKey.equals(lastNotifiedFailure)) {
                notifyManagers(
                    year + "년 공식 공휴일 연동 실패",
                    "공공데이터 공휴일 조회에 실패했습니다. API 키와 네트워크 상태를 확인한 뒤 휴일관리에서 다시 시도해 주세요."
                );
                lastNotifiedFailure = failureKey;
            }
            scheduledJobStatusService.failure(job, exception);
        }
    }

    private void notifyManagers(String title, String message) {
        for (Emp manager : empRepository.findActiveLeaveAdministrators()) {
            notificationService.notifyEmp(manager.getEmpId(), title, message, "APPROVAL_HOLIDAY", null);
        }
    }
}
