package com.kjh.groupware.domain.work;

import com.kjh.groupware.domain.emp.dto.EmpResponse;
import com.kjh.groupware.domain.work.dto.WorkScheduleResponse;
import com.kjh.groupware.global.response.ApiResponse;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/work-schedules")
@RequiredArgsConstructor
public class WorkScheduleController {
    private final WorkRequestService service;
    @GetMapping("/me") public ApiResponse<List<WorkScheduleResponse>> mine(@RequestParam LocalDate from, @RequestParam LocalDate to) { return ApiResponse.ok(service.mine(from, to)); }
    @GetMapping("/changeable") public ApiResponse<List<WorkScheduleResponse>> changeable(@RequestParam(required = false) Long empId, @RequestParam(defaultValue = "false") boolean all) { return ApiResponse.ok(service.changeable(empId, all)); }
    @GetMapping("/candidates") public ApiResponse<List<EmpResponse>> candidates() { return ApiResponse.ok(service.candidates()); }
}
