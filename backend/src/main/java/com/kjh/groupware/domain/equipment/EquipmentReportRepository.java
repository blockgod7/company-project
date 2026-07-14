package com.kjh.groupware.domain.equipment;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
public interface EquipmentReportRepository extends JpaRepository<EquipmentReport, Long> {
    List<EquipmentReport> findAllByOrderByReportIdDesc();
    List<EquipmentReport> findByEquipmentEquipmentIdOrderByReportIdDesc(Long equipmentId);
    Optional<EquipmentReport> findByInitialApprovalId(Long approvalId);
    Optional<EquipmentReport> findByCompletionApprovalId(Long approvalId);
    @Query("select r from EquipmentReport r where r.reportId = :reportId") Optional<EquipmentReport> findForUpdate(Long reportId);
}
