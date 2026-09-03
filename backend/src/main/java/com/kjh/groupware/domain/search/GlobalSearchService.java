package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.Comparator;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class GlobalSearchService {

    private static final Set<String> DEFAULT_TYPES = Set.of(
        "menus", "departments", "employees", "notices", "boards", "approvals"
    );

    private final List<GlobalSearchProvider> providers;
    private final CurrentEmpProvider currentEmpProvider;

    @Transactional(readOnly = true)
    public GlobalSearchResponse search(String keyword, int limit, List<String> types, String status) {
        String normalized = StringUtils.hasText(keyword) ? keyword.trim() : "";
        if (normalized.length() < 2) {
            return new GlobalSearchResponse(normalized, List.of(), List.of());
        }
        int safeLimit = Math.min(Math.max(limit, 1), 10);
        Emp currentEmp = currentEmpProvider.getCurrentEmp();
        Set<String> selectedTypes = normalizeTypes(types);
        String normalizedStatus = StringUtils.hasText(status) ? status.trim().toUpperCase(Locale.ROOT) : null;
        List<GlobalSearchGroupResponse> groups = new ArrayList<>();
        List<String> failedProviders = new ArrayList<>();
        providers.stream()
            .filter(provider -> selectedTypes.contains(provider.code()))
            .sorted(Comparator.comparingInt(GlobalSearchProvider::order))
            .forEach(provider -> {
                try {
                    GlobalSearchGroupResponse group = provider.search(normalized, safeLimit, currentEmp, normalizedStatus);
                    if (group.totalCount() > 0) groups.add(group);
                } catch (RuntimeException exception) {
                    failedProviders.add(provider.code());
                }
            });
        return new GlobalSearchResponse(normalized, List.copyOf(groups), List.copyOf(failedProviders));
    }

    private Set<String> normalizeTypes(List<String> types) {
        if (types == null || types.isEmpty()) return DEFAULT_TYPES;
        Set<String> selected = types.stream()
            .filter(StringUtils::hasText)
            .map(value -> value.trim().toLowerCase(Locale.ROOT))
            .filter(DEFAULT_TYPES::contains)
            .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        return selected.isEmpty() ? DEFAULT_TYPES : Set.copyOf(selected);
    }

}
