package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.domain.dept.DeptRepository;
import com.kjh.groupware.domain.emp.Emp;
import java.util.List;
import java.util.Locale;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class DepartmentGlobalSearchProvider implements GlobalSearchProvider {

    private final DeptRepository deptRepository;

    @Override
    public String code() { return "departments"; }

    @Override
    public int order() { return 45; }

    @Override
    public GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp) {
        String normalized = keyword.toLowerCase(Locale.ROOT);
        List<GlobalSearchItemResponse> items = deptRepository.findByUseYnOrderBySortOrderAscDeptIdAsc("Y").stream()
            .filter(dept -> dept.getDeptName().toLowerCase(Locale.ROOT).contains(normalized)
                || dept.getDeptCode().toLowerCase(Locale.ROOT).contains(normalized))
            .limit(limit)
            .map(this::toItem)
            .toList();
        return new GlobalSearchGroupResponse("departments", "부서", items.size(), items);
    }

    private GlobalSearchItemResponse toItem(Dept dept) {
        return new GlobalSearchItemResponse(
            "DEPARTMENT", dept.getDeptId(), dept.getParentDept() == null ? null : dept.getParentDept().getDeptId(),
            "organization", dept.getDeptName(),
            dept.getParentDept() == null ? "최상위 부서" : dept.getParentDept().getDeptName(),
            dept.getDeptCode(), List.of("ACTIVE"), dept.getCreatedAt(),
            "/portal/employee/organization?deptId=" + dept.getDeptId()
        );
    }
}
