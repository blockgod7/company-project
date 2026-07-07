package com.kjh.groupware.domain.search;

import com.kjh.groupware.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/global-search")
@RequiredArgsConstructor
public class GlobalSearchController {

    private final GlobalSearchService globalSearchService;

    @GetMapping
    public ApiResponse<GlobalSearchResponse> search(
        @RequestParam String keyword,
        @RequestParam(required = false, defaultValue = "5") int limit
    ) {
        return ApiResponse.ok(globalSearchService.search(keyword, limit));
    }
}
