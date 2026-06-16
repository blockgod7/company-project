package com.kjh.groupware.domain.emp;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmpRepository extends JpaRepository<Emp, Long> {

    Optional<Emp> findByLoginId(String loginId);

    @Query("select e from Emp e where e.loginId = :loginId and e.useYn = 'Y' and e.status = 'ACTIVE'")
    Optional<Emp> findActiveByLoginId(@Param("loginId") String loginId);

    @Query("""
        select e from Emp e
        where e.useYn = 'Y'
          and (:status is null or e.status = :status)
          and (:deptId is null or e.dept.deptId = :deptId)
          and (
            :keyword is null
            or lower(e.empName) like lower(concat('%', :keyword, '%'))
            or lower(e.loginId) like lower(concat('%', :keyword, '%'))
            or lower(e.empNo) like lower(concat('%', :keyword, '%'))
            or lower(coalesce(e.email, '')) like lower(concat('%', :keyword, '%'))
          )
        order by e.empId asc
        """)
    Page<Emp> search(
        @Param("keyword") String keyword,
        @Param("deptId") Long deptId,
        @Param("status") String status,
        Pageable pageable
    );

    @Query("""
        select e from Emp e
        where e.useYn = 'Y'
          and (:status is null or e.status = :status)
          and (:deptId is null or e.dept.deptId = :deptId)
        order by e.empId asc
        """)
    Page<Emp> searchWithoutKeyword(
        @Param("deptId") Long deptId,
        @Param("status") String status,
        Pageable pageable
    );
}
