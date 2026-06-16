package com.kjh.groupware.domain.notice.dto;

import jakarta.validation.constraints.NotBlank;

public record NoticeCommentRequest(
    @NotBlank String content
) {
}
