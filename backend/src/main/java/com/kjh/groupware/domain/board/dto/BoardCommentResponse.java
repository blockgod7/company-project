package com.kjh.groupware.domain.board.dto;

import com.kjh.groupware.domain.board.BoardComment;
import java.time.LocalDateTime;

public record BoardCommentResponse(
    Long commentId,
    Long writerEmpId,
    String writerName,
    String content,
    LocalDateTime createdAt
) {

    public static BoardCommentResponse from(BoardComment comment) {
        return new BoardCommentResponse(
            comment.getCommentId(),
            comment.getWriter().getEmpId(),
            comment.getWriter().getEmpName(),
            comment.getContent(),
            comment.getCreatedAt()
        );
    }
}
