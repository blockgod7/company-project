package com.kjh.groupware.domain.approval;
import com.kjh.groupware.global.response.ApiResponse;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("${app.api-prefix:/api/v1}/trainings")
@RequiredArgsConstructor
public class TrainingController {
    private final TrainingWorkflowService service;
    @GetMapping("/me")
    public ApiResponse<List<TrainingScheduleResponse>> mine(@RequestParam(required = false) LocalDate from,
        @RequestParam(required = false) LocalDate to, @RequestParam(required = false) Long editingApprovalId) {
        return ApiResponse.ok(service.mine(from, to, editingApprovalId));
    }
}
