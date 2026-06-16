package com.kjh.groupware.domain.notice.dto;

import com.kjh.groupware.domain.notice.Notice;
import java.time.LocalDateTime;
import java.util.List;

public record NoticeResponse(
    Long noticeId,
    String title,
    String content,
    Long writerEmpId,
    String writerName,
    int viewCount,
    boolean pinned,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    List<NoticeCommentResponse> comments
) {

    public static NoticeResponse from(Notice notice) {
        return from(notice, List.of());
    }

    public static NoticeResponse from(Notice notice, List<NoticeCommentResponse> comments) {
        return new NoticeResponse(
            notice.getNoticeId(),
            notice.getTitle(),
            notice.getContent(),
            notice.getWriter().getEmpId(),
            notice.getWriter().getEmpName(),
            notice.getViewCount() == null ? 0 : notice.getViewCount(),
            "Y".equals(notice.getPinnedYn()),
            notice.getCreatedAt(),
            notice.getUpdatedAt(),
            comments
        );
    }
}
