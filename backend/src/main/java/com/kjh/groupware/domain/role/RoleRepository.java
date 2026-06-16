package com.kjh.groupware.domain.role;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, Long> {

    Optional<Role> findByRoleCode(String roleCode);
}
