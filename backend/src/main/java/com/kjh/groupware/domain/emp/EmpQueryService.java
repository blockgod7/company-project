package com.kjh.groupware.domain.emp;

import com.kjh.groupware.domain.emp.dto.EmpResponse;
import com.kjh.groupware.domain.emp.dto.EmployeeDirectoryResponse;
import com.kjh.groupware.global.exception.BusinessException;
import com.kjh.groupware.global.response.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class EmpQueryService {

    private final EmpRepository empRepository;

    @Transactional(readOnly = true)
    public PageResponse<EmpResponse> search(String keyword, Long deptId, String status, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(safePage, safeSize);
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        String normalizedStatus = normalizeStatus(status);
        if (normalizedKeyword == null) {
            return PageResponse.from(empRepository.searchWithoutKeyword(deptId, normalizedStatus, pageable)
                .map(EmpResponse::from));
        }
        return PageResponse.from(empRepository.search(normalizedKeyword, deptId, normalizedStatus, pageable).map(EmpResponse::from));
    }

    @Transactional(readOnly = true)
    public PageResponse<EmployeeDirectoryResponse> searchDirectory(String keyword, Long deptId, String status, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Pageable pageable = PageRequest.of(safePage, safeSize);
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        String normalizedStatus = normalizeStatus(status);
        if (normalizedKeyword == null) {
            return PageResponse.from(empRepository.searchDirectoryWithoutKeyword(deptId, normalizedStatus, pageable)
                .map(EmployeeDirectoryResponse::from));
        }
        return PageResponse.from(empRepository.searchDirectory(normalizedKeyword, deptId, normalizedStatus, pageable)
            .map(EmployeeDirectoryResponse::from));
    }

    @Transactional(readOnly = true)
    public EmpResponse findById(Long empId) {
        Emp employee = empRepository.findById(empId)
            .orElseThrow(() -> BusinessException.notFound("EMP_NOT_FOUND", "Employee was not found"));
        return EmpResponse.from(employee);
    }

    private String normalizeStatus(String status) {
        if (!StringUtils.hasText(status) || "ALL".equalsIgnoreCase(status.trim())) return null;
        return status.trim();
    }
}
