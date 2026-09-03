package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.emp.Emp;
import java.util.List;

public interface GlobalSearchProvider {

    String code();

    int order();

    GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp);

    // Providers with mixed statuses must override this and filter before limiting results.
    default GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp, String status) {
        GlobalSearchGroupResponse group = search(keyword, limit, currentEmp);
        if (status == null || "ALL".equals(status)) return group;
        List<GlobalSearchItemResponse> items = group.items().stream()
            .filter(item -> item.badges().stream().anyMatch(status::equalsIgnoreCase))
            .toList();
        long total = items.size() == group.items().size() ? group.totalCount() : items.size();
        return new GlobalSearchGroupResponse(group.code(), group.label(), total, items);
    }
}
