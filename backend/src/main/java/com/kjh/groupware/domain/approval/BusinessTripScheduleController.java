package com.kjh.groupware.domain.approval;

import com.kjh.groupware.global.response.ApiResponse;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("${app.api-prefix:/api/v1}/business-trips")
public class BusinessTripScheduleController {
    private final BusinessTripScheduleService service;

    @GetMapping("/me")
    public ApiResponse<List<BusinessTripScheduleService.Schedule>> mySchedules(
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return ApiResponse.ok(service.mySchedules(from, to));
    }
}
