package com.kjh.groupware.domain.board.dto;

import jakarta.validation.constraints.NotBlank;

public record BoardCommentRequest(
    @NotBlank String content
) {
}
