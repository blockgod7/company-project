package com.kjh.groupware.domain.dept;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeptRepository extends JpaRepository<Dept, Long> {

    Optional<Dept> findByDeptCode(String deptCode);
}
