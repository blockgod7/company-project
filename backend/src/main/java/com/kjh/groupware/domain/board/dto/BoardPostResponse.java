package com.kjh.groupware.domain.board.dto;

import com.kjh.groupware.domain.board.BoardPost;
import java.time.LocalDateTime;
import java.util.List;

public record BoardPostResponse(
    Long postId,
    Long boardId,
    String title,
    String content,
    Long writerEmpId,
    String writerName,
    int viewCount,
    boolean draft,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    List<BoardCommentResponse> comments
) {

    public static BoardPostResponse from(BoardPost post) {
        return from(post, List.of());
    }

    public static BoardPostResponse from(BoardPost post, List<BoardCommentResponse> comments) {
        return new BoardPostResponse(
            post.getPostId(),
            post.getBoard().getBoardId(),
            post.getTitle(),
            post.getContent(),
            post.getWriter().getEmpId(),
            post.getWriter().getEmpName(),
            post.getViewCount() == null ? 0 : post.getViewCount(),
            "Y".equals(post.getDraftYn()),
            post.getCreatedAt(),
            post.getUpdatedAt(),
            comments
        );
    }
}
