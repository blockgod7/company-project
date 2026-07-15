package com.kjh.groupware.domain.equipment;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EquipmentAssignmentAuthorityRepository extends JpaRepository<EquipmentAssignmentAuthority, Long> {
    boolean existsByEmpEmpId(Long empId);
    Optional<EquipmentAssignmentAuthority> findByEmpEmpId(Long empId);
    List<EquipmentAssignmentAuthority> findAllByOrderByCreatedAtDesc();
}
