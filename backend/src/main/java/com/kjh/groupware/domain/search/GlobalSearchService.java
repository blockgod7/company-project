package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class GlobalSearchService {

    private final List<GlobalSearchProvider> providers;
    private final CurrentEmpProvider currentEmpProvider;

    @Transactional(readOnly = true)
    public GlobalSearchResponse search(String keyword, int limit) {
        String normalized = StringUtils.hasText(keyword) ? keyword.trim() : "";
        if (normalized.length() < 2) {
            return new GlobalSearchResponse(normalized, List.of());
        }
        int safeLimit = Math.min(Math.max(limit, 1), 10);
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        List<GlobalSearchGroupResponse> groups = providers.stream()
            .sorted(Comparator.comparingInt(GlobalSearchProvider::order))
            .map(provider -> provider.search(normalized, safeLimit, currentEmp))
            .filter(group -> group.totalCount() > 0)
            .toList();
        return new GlobalSearchResponse(normalized, groups);
    }
}
