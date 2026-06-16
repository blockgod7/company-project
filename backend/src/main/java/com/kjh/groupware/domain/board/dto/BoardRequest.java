package com.kjh.groupware.domain.board.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record BoardRequest(
    @NotBlank @Size(max = 50) String boardCode,
    @NotBlank @Size(max = 100) String boardName,
    Long deptId
) {
}
