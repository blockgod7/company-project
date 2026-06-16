package com.kjh.groupware.domain.emp;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmpRepository extends JpaRepository<Emp, Long> {

    Optional<Emp> findByLoginId(String loginId);

    @Query("select e from Emp e where e.loginId = :loginId and e.useYn = 'Y' and e.status = 'ACTIVE'")
    Optional<Emp> findActiveByLoginId(@Param("loginId") String loginId);
}
