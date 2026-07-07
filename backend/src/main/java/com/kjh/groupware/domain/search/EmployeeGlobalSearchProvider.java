package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.emp.EmpRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class EmployeeGlobalSearchProvider implements GlobalSearchProvider {

    private final EmpRepository empRepository;

    @Override
    public int order() {
        return 50;
    }

    @Override
    public GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp) {
        Page<Emp> page = empRepository.search(keyword, null, "ACTIVE", PageRequest.of(0, limit));
        List<GlobalSearchItemResponse> items = page.getContent().stream()
            .map(emp -> new GlobalSearchItemResponse(
                "EMPLOYEE",
                emp.getEmpId(),
                emp.getDept() == null ? null : emp.getDept().getDeptId(),
                "organization",
                emp.getEmpName(),
                GlobalSearchText.join(emp.getDept() == null ? null : emp.getDept().getDeptName(), emp.getPositionName(), emp.getJobTitle()),
                GlobalSearchText.join(emp.getEmpNo(), emp.getLoginId(), emp.getEmail()),
                List.of("부서", emp.getRoleCode()),
                emp.getCreatedAt()
            ))
            .toList();
        return new GlobalSearchGroupResponse("employees", "조직/직원", page.getTotalElements(), items);
    }
}
