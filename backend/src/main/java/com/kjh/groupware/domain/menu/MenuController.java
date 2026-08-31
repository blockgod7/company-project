package com.kjh.groupware.domain.menu;

import com.kjh.groupware.domain.menu.dto.EffectiveMenuResponse;
import com.kjh.groupware.domain.menu.dto.MenuPreferenceUpdateRequest;
import com.kjh.groupware.global.response.ApiResponse;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("${app.api-prefix:/api/v1}/menus")
@RequiredArgsConstructor
public class MenuController {

    private final MenuService menuService;

    @GetMapping("/effective")
    public ApiResponse<List<EffectiveMenuResponse>> findEffective(
        @RequestParam(defaultValue = "EMPLOYEE") String portal
    ) {
        return ApiResponse.ok(menuService.findEffective(portal));
    }

    @PutMapping("/preferences")
    public ApiResponse<List<EffectiveMenuResponse>> updatePreferences(
        @RequestParam(defaultValue = "EMPLOYEE") String portal,
        @Valid @RequestBody MenuPreferenceUpdateRequest request
    ) {
        return ApiResponse.ok(menuService.updatePreferences(portal, request));
    }

    @DeleteMapping("/preferences")
    public ApiResponse<List<EffectiveMenuResponse>> resetPreferences(
        @RequestParam(defaultValue = "EMPLOYEE") String portal
    ) {
        return ApiResponse.ok(menuService.resetPreferences(portal));
    }
}
