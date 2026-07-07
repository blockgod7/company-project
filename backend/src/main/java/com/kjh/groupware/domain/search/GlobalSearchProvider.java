package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.emp.Emp;

public interface GlobalSearchProvider {

    int order();

    GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp);
}
