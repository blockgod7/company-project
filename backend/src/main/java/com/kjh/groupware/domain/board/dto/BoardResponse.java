package com.kjh.groupware.domain.board.dto;

import com.kjh.groupware.domain.board.Board;

public record BoardResponse(
    Long boardId,
    String boardCode,
    String boardName,
    Long deptId,
    String deptName
) {

    public static BoardResponse from(Board board) {
        return new BoardResponse(
            board.getBoardId(),
            board.getBoardCode(),
            board.getBoardName(),
            board.getDept() == null ? null : board.getDept().getDeptId(),
            board.getDept() == null ? null : board.getDept().getDeptName()
        );
    }
}
