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
    LocalDateTime occurredAt
) {
}
