package com.kjh.groupware.domain.equipment;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EquipmentMigrationRunRepository extends JpaRepository<EquipmentMigrationRun, Long> {
    List<EquipmentMigrationRun> findAllByOrderByStartedAtDesc();
}
