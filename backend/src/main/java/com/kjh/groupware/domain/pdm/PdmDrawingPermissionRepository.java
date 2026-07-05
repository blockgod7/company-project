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
}
