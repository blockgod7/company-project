package com.kjh.groupware.domain.dept;

import com.kjh.groupware.domain.dept.dto.DeptTreeResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DeptService {

    private final DeptRepository deptRepository;

    @Transactional(readOnly = true)
    public List<DeptTreeResponse> findTree() {
        List<Dept> depts = deptRepository.findByUseYnOrderBySortOrderAscDeptIdAsc("Y");
        Map<Long, DeptTreeResponse> nodes = new LinkedHashMap<>();
        for (Dept dept : depts) {
            nodes.put(dept.getDeptId(), DeptTreeResponse.mutable(dept));
        }

        List<DeptTreeResponse> roots = new ArrayList<>();
        for (Dept dept : depts) {
            DeptTreeResponse node = nodes.get(dept.getDeptId());
            Long parentId = dept.getParentDept() == null ? null : dept.getParentDept().getDeptId();
            if (parentId == null || !nodes.containsKey(parentId)) {
                roots.add(node);
            } else {
                nodes.get(parentId).children().add(node);
            }
        }
        return roots;
    }
}
