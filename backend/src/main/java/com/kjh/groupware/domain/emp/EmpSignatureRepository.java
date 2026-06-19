package com.kjh.groupware.domain.emp;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmpSignatureRepository extends JpaRepository<EmpSignature, Long> {

    Optional<EmpSignature> findTopByEmpAndActiveYnOrderBySignatureIdDesc(Emp emp, String activeYn);
}
