package com.kjh.groupware.global.security;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import com.kjh.groupware.global.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CurrentEmpProvider {

    private final EmpRepository empRepository;

    public Emp getCurrentEmp() {
        return empRepository.findActiveByLoginId(getCurrentLoginId())
            .orElseThrow(() -> BusinessException.unauthorized("UNAUTHORIZED", "Authenticated employee was not found"));
    }

    public String getCurrentLoginId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw BusinessException.unauthorized("UNAUTHORIZED", "Authentication is required");
        }

        return authentication.getName();
    }

    public Long getCurrentEmpId() {
        return getCurrentEmp().getEmpId();
    }
}
