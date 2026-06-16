package com.kjh.groupware.domain.board.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BoardPostRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank String content,
    boolean draft
) {
}
