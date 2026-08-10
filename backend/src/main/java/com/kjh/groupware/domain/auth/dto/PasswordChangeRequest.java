package com.kjh.groupware.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PasswordChangeRequest(@NotBlank @Size(min = 8, max = 100) String newPassword) {}
