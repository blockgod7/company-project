package com.kjh.groupware.domain.approval;
import com.kjh.groupware.domain.approval.dto.*;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
@RestController @RequestMapping("${app.api-prefix:/api/v1}/annual-leaves") @RequiredArgsConstructor
public class AnnualLeaveController { private final AnnualLeaveService service; @GetMapping public ApiResponse<List<AnnualLeaveResponse>> current(){return ApiResponse.ok(service.currentForHr());} @PutMapping public ApiResponse<AnnualLeaveResponse> adjust(@Valid @RequestBody AnnualLeaveAdjustmentRequest r){return ApiResponse.ok(service.adjust(r));} }
