package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.menu.MenuService;
import com.kjh.groupware.domain.menu.dto.EffectiveMenuResponse;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class MenuGlobalSearchProvider implements GlobalSearchProvider {

    private final MenuService menuService;

    @Override
    public String code() { return "menus"; }

    @Override
    public int order() { return 5; }

    @Override
    public GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp) {
        return search(keyword, limit, currentEmp, null);
    }

    @Override
    public GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp, String status) {
        String menuStatus = "ACTIVE".equals(status) ? "IMPLEMENTED" : status;
        String normalized = keyword.toLowerCase(Locale.ROOT);
        List<GlobalSearchItemResponse> items = Stream.concat(
                menuService.findEffectiveFor(currentEmp, "EMPLOYEE").stream(),
                menuService.findEffectiveFor(currentEmp, "ADMIN").stream()
            )
            .filter(menu -> !menu.hidden() && menu.menuPath() != null)
            .filter(menu -> matches(menu, normalized))
            .filter(menu -> menuStatus == null || "ALL".equals(menuStatus) || menuStatus.equals(menu.implementationStatus()))
            .limit(limit)
            .map(menu -> new GlobalSearchItemResponse(
                "MENU", menu.menuId(), null, "menu", menu.menuName(),
                menu.portalCode().equals("ADMIN") ? "관리 포털 메뉴" : "임직원 포털 메뉴",
                menu.menuCode(), List.of(menu.implementationStatus()), null, menu.menuPath()
            ))
            .toList();
        return new GlobalSearchGroupResponse("menus", "메뉴", items.size(), items);
    }

    private boolean matches(EffectiveMenuResponse menu, String keyword) {
        return menu.menuName().toLowerCase(Locale.ROOT).contains(keyword)
            || menu.menuCode().toLowerCase(Locale.ROOT).contains(keyword);
    }
}
