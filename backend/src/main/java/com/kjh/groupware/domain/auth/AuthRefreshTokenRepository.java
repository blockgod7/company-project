package com.kjh.groupware.domain.auth;

import com.kjh.groupware.domain.emp.Emp;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuthRefreshTokenRepository extends JpaRepository<AuthRefreshToken, Long> {

    Optional<AuthRefreshToken> findByTokenHash(String tokenHash);

    void deleteByEmp(Emp emp);
}
