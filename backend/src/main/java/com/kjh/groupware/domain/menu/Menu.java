package com.kjh.groupware.domain.menu;

import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "menu")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Menu extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "menu_id")
    private Long menuId;

    @Column(name = "menu_code", nullable = false, unique = true, length = 60)
    private String menuCode;

    @Column(name = "menu_name", nullable = false, length = 100)
    private String menuName;

    @Column(name = "menu_path", length = 255)
    private String menuPath;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_menu_id")
    private Menu parentMenu;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(name = "portal_code", nullable = false, length = 20)
    private String portalCode;

    @Column(name = "icon_key", length = 60)
    private String iconKey;

    @Column(name = "implementation_status", nullable = false, length = 20)
    private String implementationStatus;

    @Column(name = "required_permission_code", length = 60)
    private String requiredPermissionCode;

    @Column(name = "searchable_yn", nullable = false, length = 1)
    private String searchableYn;

    @Column(name = "use_yn", nullable = false, length = 1)
    private String useYn;
}
