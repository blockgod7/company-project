package com.kjh.groupware.domain.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CompTimeExpiryRequest(
    @NotNull LocalDate expiresOn,
    @NotBlank @Size(max = 500) String reason
) {}
