package com.kjh.groupware.domain.menu.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record MenuPreferenceUpdateRequest(
    @NotNull @Size(max = 200) List<@Valid MenuPreferenceItemRequest> items
) {}
