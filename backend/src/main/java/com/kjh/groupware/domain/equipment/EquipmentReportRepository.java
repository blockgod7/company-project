package com.kjh.groupware.domain.equipment;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
public interface EquipmentReportRepository extends JpaRepository<EquipmentReport, Long> {
    List<EquipmentReport> findAllByOrderByReportIdDesc();
    @EntityGraph(attributePaths = {"equipment", "reporter", "assignee", "cancelledBy"})
    Page<EquipmentReport> findByStateInOrderByReportIdDesc(Collection<String> states, Pageable pageable);
    @EntityGraph(attributePaths = {"equipment", "reporter", "assignee", "cancelledBy"})
    Page<EquipmentReport> findByStateNotInOrderByReportIdDesc(Collection<String> states, Pageable pageable);
    List<EquipmentReport> findByEquipmentEquipmentIdOrderByReportIdDesc(Long equipmentId);
    Optional<EquipmentReport> findByInitialApprovalId(Long approvalId);
    Optional<EquipmentReport> findByCompletionApprovalId(Long approvalId);
    @Query("select r from EquipmentReport r where r.reportId = :reportId") Optional<EquipmentReport> findForUpdate(Long reportId);
}
