package com.kjh.groupware.domain.notice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record NoticeRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank String content,
    boolean pinned
) {
}
