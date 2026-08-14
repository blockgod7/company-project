package com.kjh.groupware.domain.search;

import java.time.LocalDateTime;
import java.util.List;

public record GlobalSearchItemResponse(
    String type,
    Long targetId,
    Long parentId,
    String route,
    String title,
    String summary,
    String meta,
    List<String> badges,
    LocalDateTime occurredAt,
    String destinationPath
) {
    public GlobalSearchItemResponse(
        String type,
        Long targetId,
        Long parentId,
        String route,
        String title,
        String summary,
        String meta,
        List<String> badges,
        LocalDateTime occurredAt
    ) {
        this(type, targetId, parentId, route, title, summary, meta, badges, occurredAt, null);
    }
}
