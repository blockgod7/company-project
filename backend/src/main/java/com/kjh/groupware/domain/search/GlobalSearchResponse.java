package com.kjh.groupware.domain.search;

import java.util.List;

public record GlobalSearchResponse(
    String keyword,
    List<GlobalSearchGroupResponse> groups
) {
}
