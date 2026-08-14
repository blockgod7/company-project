package com.kjh.groupware.domain.menu.dto;

public record EffectiveMenuResponse(
    Long menuId,
    String menuCode,
    String menuName,
    String menuPath,
    String parentMenuCode,
    String portalCode,
    String iconKey,
    String implementationStatus,
    String requiredPermissionCode,
    int defaultSortOrder,
    int effectiveSortOrder,
    boolean pinned,
    boolean hidden,
    boolean searchable
) {}
