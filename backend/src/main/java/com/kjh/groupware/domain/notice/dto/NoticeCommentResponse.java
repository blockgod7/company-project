package com.kjh.groupware.domain.notice.dto;

import com.kjh.groupware.domain.notice.NoticeComment;
import java.time.LocalDateTime;

public record NoticeCommentResponse(
    Long commentId,
    Long writerEmpId,
    String writerName,
    String content,
    LocalDateTime createdAt
) {

    public static NoticeCommentResponse from(NoticeComment comment) {
        return new NoticeCommentResponse(
            comment.getCommentId(),
            comment.getWriter().getEmpId(),
            comment.getWriter().getEmpName(),
            comment.getContent(),
            comment.getCreatedAt()
        );
    }
}
