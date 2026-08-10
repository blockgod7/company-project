package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ScheduledJobStatusResponse;
import com.kjh.groupware.global.response.ApiResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/approval-operations/schedulers")
@RequiredArgsConstructor
public class ScheduledJobStatusController {
    private final ScheduledJobStatusService service;
    @GetMapping public ApiResponse<List<ScheduledJobStatusResponse>> list() { return ApiResponse.ok(service.list()); }
}
