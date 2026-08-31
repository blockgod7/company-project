package com.kjh.groupware.domain.search;

import com.kjh.groupware.domain.emp.Emp;

public interface GlobalSearchProvider {

    String code();

    int order();

    GlobalSearchGroupResponse search(String keyword, int limit, Emp currentEmp);
}
