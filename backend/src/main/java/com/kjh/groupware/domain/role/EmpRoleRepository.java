package com.kjh.groupware.domain.role;

import com.kjh.groupware.domain.emp.Emp;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmpRoleRepository extends JpaRepository<EmpRole, Long> {

    List<EmpRole> findByEmpAndUseYn(Emp emp, String useYn);
}
