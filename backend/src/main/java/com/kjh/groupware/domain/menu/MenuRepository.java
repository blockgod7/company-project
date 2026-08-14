package com.kjh.groupware.domain.menu;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MenuRepository extends JpaRepository<Menu, Long> {
    List<Menu> findByUseYnOrderByPortalCodeAscSortOrderAscMenuIdAsc(String useYn);
    List<Menu> findByMenuCodeIn(Collection<String> menuCodes);
}
