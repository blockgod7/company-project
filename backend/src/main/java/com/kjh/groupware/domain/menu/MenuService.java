package com.kjh.groupware.domain.menu;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmployeePermissionService;
import com.kjh.groupware.domain.menu.dto.EffectiveMenuResponse;
import com.kjh.groupware.domain.menu.dto.MenuPreferenceItemRequest;
import com.kjh.groupware.domain.menu.dto.MenuPreferenceUpdateRequest;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.security.CurrentEmpProvider;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MenuService {

    private static final Set<String> PORTAL_CODES = Set.of("EMPLOYEE", "ADMIN");
    private static final String PLANNED = "PLANNED";

    private final MenuRepository menuRepository;
    private final UserMenuPreferenceRepository preferenceRepository;
    private final CurrentEmpProvider currentEmpProvider;
    private final EmployeePermissionService permissionService;

    @Transactional(readOnly = true)
    public List<EffectiveMenuResponse> findEffective(String portal) {
        Emp emp = currentEmpProvider.getCurrentEmp();
        return findEffectiveFor(emp, normalizePortal(portal));
    }

    @Transactional
    public List<EffectiveMenuResponse> updatePreferences(String portal, MenuPreferenceUpdateRequest request) {
        Emp emp = currentEmpProvider.getCurrentEmp();
        String normalizedPortal = normalizePortal(portal);
        List<MenuPreferenceItemRequest> items = request.items();
        Set<String> codes = items.stream()
            .map(item -> normalizeMenuCode(item.menuCode()))
            .collect(Collectors.toCollection(HashSet::new));
        if (codes.size() != items.size()) {
            throw BusinessException.badRequest("MENU_PREFERENCE_DUPLICATED", "동일한 메뉴를 중복 설정할 수 없습니다.");
        }

        Map<String, Menu> menus = menuRepository.findByMenuCodeIn(codes).stream()
            .collect(Collectors.toMap(Menu::getMenuCode, Function.identity()));
        if (menus.size() != codes.size()) {
            throw BusinessException.badRequest("MENU_NOT_FOUND", "설정 대상 메뉴를 찾을 수 없습니다.");
        }

        Map<Long, UserMenuPreference> preferences = preferenceRepository.findByEmpEmpId(emp.getEmpId()).stream()
            .collect(Collectors.toMap(preference -> preference.getMenu().getMenuId(), Function.identity()));
        for (MenuPreferenceItemRequest item : items) {
            Menu menu = menus.get(normalizeMenuCode(item.menuCode()));
            if (!normalizedPortal.equals(menu.getPortalCode()) || !canAccess(emp, menu)) {
                throw BusinessException.forbidden("MENU_PREFERENCE_FORBIDDEN", "접근할 수 없는 메뉴는 설정할 수 없습니다.");
            }
            if (menu.getMenuCode().endsWith("_HOME") && item.hidden()) {
                throw BusinessException.badRequest("MENU_HOME_HIDDEN_FORBIDDEN", "포털 홈 메뉴는 숨길 수 없습니다.");
            }
            UserMenuPreference preference = preferences.computeIfAbsent(
                menu.getMenuId(), ignored -> new UserMenuPreference(emp, menu)
            );
            preference.update(item.sortOrder(), item.pinned(), item.hidden());
            preferenceRepository.save(preference);
        }
        return findEffectiveFor(emp, normalizedPortal);
    }

    @Transactional
    public List<EffectiveMenuResponse> resetPreferences(String portal) {
        Emp emp = currentEmpProvider.getCurrentEmp();
        String normalizedPortal = normalizePortal(portal);
        List<UserMenuPreference> portalPreferences = preferenceRepository.findByEmpEmpId(emp.getEmpId()).stream()
            .filter(preference -> normalizedPortal.equals(preference.getMenu().getPortalCode()))
            .toList();
        preferenceRepository.deleteAll(portalPreferences);
        return findEffectiveFor(emp, normalizedPortal);
    }

    public List<EffectiveMenuResponse> findEffectiveFor(Emp emp, String portal) {
        Map<Long, UserMenuPreference> preferences = preferenceRepository.findByEmpEmpId(emp.getEmpId()).stream()
            .collect(Collectors.toMap(preference -> preference.getMenu().getMenuId(), Function.identity()));
        return menuRepository.findByUseYnOrderByPortalCodeAscSortOrderAscMenuIdAsc("Y").stream()
            .filter(menu -> portal.equals(menu.getPortalCode()))
            .filter(menu -> canAccess(emp, menu))
            .map(menu -> toResponse(menu, preferences.get(menu.getMenuId())))
            .sorted(Comparator.comparing(EffectiveMenuResponse::pinned).reversed()
                .thenComparingInt(EffectiveMenuResponse::effectiveSortOrder)
                .thenComparingLong(EffectiveMenuResponse::menuId))
            .toList();
    }

    private boolean canAccess(Emp emp, Menu menu) {
        if (PLANNED.equals(menu.getImplementationStatus()) && !isSystemOrFullAdmin(emp)) {
            return false;
        }
        String permission = menu.getRequiredPermissionCode();
        if (permission == null || permission.isBlank()) return true;
        return switch (permission) {
            case "ADMIN_PORTAL" -> canAccessAdminPortal(emp);
            case "EMPLOYEE_MANAGE" -> permissionService.hasPermission(emp, EmployeePermissionService.EMPLOYEE_ADMIN)
                || permissionService.hasPermission(emp, EmployeePermissionService.WORK_CATEGORY_ADMIN);
            case "SYSTEM_ADMIN" -> "ADMIN".equals(emp.getRoleCode());
            default -> permissionService.hasPermission(emp, permission);
        };
    }

    private boolean canAccessAdminPortal(Emp emp) {
        if ("ADMIN".equals(emp.getRoleCode()) || "APPROVAL_ADMIN".equals(emp.getRoleCode())
            || "AUDIT_ADMIN".equals(emp.getRoleCode())) {
            return true;
        }
        return permissionService.hasPermission(emp, EmployeePermissionService.FULL_ADMIN)
            || permissionService.hasPermission(emp, EmployeePermissionService.LEAVE_ADMIN)
            || permissionService.hasPermission(emp, EmployeePermissionService.LEAVE_POLICY_ADMIN)
            || permissionService.hasPermission(emp, EmployeePermissionService.EMPLOYEE_ADMIN)
            || permissionService.hasPermission(emp, EmployeePermissionService.WORK_CATEGORY_ADMIN)
            || permissionService.hasPermission(emp, EmployeePermissionService.ACCOUNT_ADMIN);
    }

    private boolean isSystemOrFullAdmin(Emp emp) {
        return "ADMIN".equals(emp.getRoleCode())
            || permissionService.hasPermission(emp, EmployeePermissionService.FULL_ADMIN);
    }

    private EffectiveMenuResponse toResponse(Menu menu, UserMenuPreference preference) {
        int defaultOrder = menu.getSortOrder() == null ? 0 : menu.getSortOrder();
        int effectiveOrder = preference == null || preference.getSortOrder() == null
            ? defaultOrder : preference.getSortOrder();
        return new EffectiveMenuResponse(
            menu.getMenuId(), menu.getMenuCode(), menu.getMenuName(), menu.getMenuPath(),
            menu.getParentMenu() == null ? null : menu.getParentMenu().getMenuCode(),
            menu.getPortalCode(), menu.getIconKey(), menu.getImplementationStatus(),
            menu.getRequiredPermissionCode(), defaultOrder, effectiveOrder,
            preference != null && "Y".equals(preference.getPinnedYn()),
            preference != null && "Y".equals(preference.getHiddenYn()),
            "Y".equals(menu.getSearchableYn())
        );
    }

    private String normalizePortal(String portal) {
        String normalized = portal == null ? "EMPLOYEE" : portal.trim().toUpperCase(Locale.ROOT);
        if (!PORTAL_CODES.contains(normalized)) {
            throw BusinessException.badRequest("PORTAL_CODE_INVALID", "지원하지 않는 포털 구분입니다.");
        }
        return normalized;
    }

    private String normalizeMenuCode(String menuCode) {
        return menuCode.trim().toUpperCase(Locale.ROOT);
    }
}
