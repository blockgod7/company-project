package com.kjh.groupware.domain.menu;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserMenuPreferenceRepository extends JpaRepository<UserMenuPreference, Long> {
    List<UserMenuPreference> findByEmpEmpId(Long empId);
    Optional<UserMenuPreference> findByEmpEmpIdAndMenuMenuId(Long empId, Long menuId);
    void deleteByEmpEmpId(Long empId);
}
