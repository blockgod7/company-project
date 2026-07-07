package com.kjh.groupware.domain.search;

import java.util.List;

public record GlobalSearchGroupResponse(
    String code,
    String label,
    long totalCount,
    List<GlobalSearchItemResponse> items
) {
}
