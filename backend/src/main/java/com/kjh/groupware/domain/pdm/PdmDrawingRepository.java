package com.kjh.groupware.domain.pdm;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PdmDrawingRepository extends JpaRepository<PdmDrawing, Long> {

    Optional<PdmDrawing> findByDrawingNoIgnoreCase(String drawingNo);

    boolean existsByDrawingNoIgnoreCase(String drawingNo);

    @Query("""
        select d from PdmDrawing d
        where (:category is null or d.category = :category)
          and (
            :keyword is null
            or lower(d.drawingNo) like lower(concat('%', :keyword, '%'))
            or lower(d.title) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(d.companyName, '')) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(d.projectName, '')) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(d.businessUnit, '')) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(d.processName, '')) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(d.equipmentName, '')) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(d.groupName, '')) like lower(concat('%', :keyword, '%'))
          )
        order by d.drawingId desc
        """)
    Page<PdmDrawing> search(@Param("category") String category, @Param("keyword") String keyword, Pageable pageable);
}
