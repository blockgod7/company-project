package com.kjh.groupware.domain.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

// Only self-service contact fields are accepted; HR/account permissions remain administrator-owned.
public record MyProfileUpdateRequest(
    @Email @Size(max = 150) String email,
    @Size(max = 50) String phone,
    @Size(max = 20) String extensionNumber
) {
    public MyProfileUpdateRequest {
        email = clean(email);
        phone = clean(phone);
        extensionNumber = clean(extensionNumber);
    }

    private static String clean(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }
}
