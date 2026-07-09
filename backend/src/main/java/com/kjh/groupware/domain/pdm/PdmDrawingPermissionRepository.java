package com.kjh.groupware.domain.pdm;

import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.domain.emp.Emp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PdmDrawingPermissionRepository extends JpaRepository<PdmDrawingPermission, Long> {

    @Query("""
        select p from PdmDrawingPermission p
        where p.emp = :emp or (:dept is not null and p.dept = :dept)
        """)
    List<PdmDrawingPermission> findEffective(@Param("emp") Emp emp, @Param("dept") Dept dept);

    @Query("""
        select p from PdmDrawingPermission p
        where (:category is null and p.category is null or p.category = :category)
          and (:drawing is null and p.drawing is null or p.drawing = :drawing)
          and (:dept is null and p.dept is null or p.dept = :dept)
          and (:emp is null and p.emp is null or p.emp = :emp)
        order by p.permissionId desc
        """)
    List<PdmDrawingPermission> findSameTarget(
        @Param("category") String category,
        @Param("drawing") PdmDrawing drawing,
        @Param("dept") Dept dept,
        @Param("emp") Emp emp
    );
}
