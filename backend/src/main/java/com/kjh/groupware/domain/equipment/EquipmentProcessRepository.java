package com.kjh.groupware.domain.equipment;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EquipmentProcessRepository extends JpaRepository<EquipmentProcess, Long> {
    List<EquipmentProcess> findByUseYnOrderByProcessNameAsc(String useYn);
    Optional<EquipmentProcess> findByProcessName(String processName);
}
