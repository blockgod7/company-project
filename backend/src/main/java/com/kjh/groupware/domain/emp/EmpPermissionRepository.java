package com.kjh.groupware.domain.emp;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmpPermissionRepository extends JpaRepository<EmpPermission, Long> {
    boolean existsByEmpEmpIdAndPermissionCodeAndActiveYn(Long empId, String permissionCode, String activeYn);
    Optional<EmpPermission> findByEmpEmpIdAndPermissionCode(Long empId, String permissionCode);
    List<EmpPermission> findByEmpEmpIdAndActiveYnOrderByPermissionCode(Long empId, String activeYn);
}
