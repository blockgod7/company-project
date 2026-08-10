package com.kjh.groupware.domain.emp;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmpRepository extends JpaRepository<Emp, Long> {

    Optional<Emp> findByLoginId(String loginId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from Emp e where e.empId = :empId")
    Optional<Emp> findByIdForUpdate(@Param("empId") Long empId);

    boolean existsByEmpNo(String empNo);

    boolean existsByLoginId(String loginId);

    List<Emp> findAllByOrderByEmpNameAsc();

    @Query("select e from Emp e where e.useYn = 'Y' and e.status = 'ACTIVE' and e.accountStatus = 'ACTIVE' and e.loginId is not null order by e.empId asc")
    List<Emp> findActiveLoginOptions();

    @Query(value = """
        select e.*
        from emp e
        where e.use_yn = 'Y' and e.status = 'ACTIVE'
          and (e.role_code = 'ADMIN' or e.login_id in ('e0015', 'e7016')
            or exists (
              select 1
              from emp_permission p
              where p.emp_id = e.emp_id
                and p.permission_code = 'LEAVE_ADMIN'
                and p.active_yn = 'Y'
            ))
        order by e.emp_id asc
        """, nativeQuery = true)
    List<Emp> findActiveLeaveAdministrators();

    @Query("select e from Emp e where e.loginId = :loginId and e.useYn = 'Y' and e.status = 'ACTIVE' and e.accountStatus = 'ACTIVE'")
    Optional<Emp> findActiveByLoginId(@Param("loginId") String loginId);

    @Query("""
        select e from Emp e
        where e.useYn = 'Y'
          and e.status = 'ACTIVE'
          and e.dept.deptCode = :deptCode
        order by
          case when e.roleCode in ('MANAGER', 'APPROVAL_ADMIN', 'ADMIN') then 0 else 1 end,
          e.empId asc
        """)
    List<Emp> findActiveByDeptCodeOrderForRouting(@Param("deptCode") String deptCode);

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
