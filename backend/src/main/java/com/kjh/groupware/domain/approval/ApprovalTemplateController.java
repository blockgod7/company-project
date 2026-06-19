package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.approval.dto.ApprovalTemplateResponse;
import com.kjh.groupware.global.response.ApiResponse;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/approval-templates")
@RequiredArgsConstructor
public class ApprovalTemplateController {

    private final ApprovalTemplateRepository templateRepository;

    @GetMapping
    public ApiResponse<List<ApprovalTemplateResponse>> findLatestActive() {
        return ApiResponse.ok(templateRepository.findLatestActiveTemplates().stream()
            .map(ApprovalTemplateResponse::from)
            .toList());
    }
}
