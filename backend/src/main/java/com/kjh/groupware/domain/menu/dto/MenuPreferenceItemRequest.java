package com.kjh.groupware.domain.menu.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MenuPreferenceItemRequest(
    @NotBlank @Size(max = 60) String menuCode,
    @Min(0) @Max(9999) Integer sortOrder,
    boolean pinned,
    boolean hidden
) {}
