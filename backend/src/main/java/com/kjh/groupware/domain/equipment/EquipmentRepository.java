package com.kjh.groupware.domain.equipment;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EquipmentRepository extends JpaRepository<Equipment, Long> {
    Optional<Equipment> findByEquipmentNo(String equipmentNo);
    List<Equipment> findAllByOrderByEquipmentNoAsc();
}
