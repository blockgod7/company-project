package com.kjh.groupware.domain.equipment;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
public interface EquipmentHistoryEventRepository extends JpaRepository<EquipmentHistoryEvent, Long> {
    List<EquipmentHistoryEvent> findByEquipmentEquipmentIdOrderByEventIdDesc(Long equipmentId);
}
