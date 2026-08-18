package com.kjh.groupware.domain.emp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

class EmpQueryServiceTest {

    private final EmpRepository empRepository = mock(EmpRepository.class);
    private final EmpQueryService service = new EmpQueryService(empRepository);

    @Test
    void directoryWithoutKeywordUsesSystemAdminExcludedQuery() {
        when(empRepository.searchDirectoryWithoutKeyword(eq(3L), eq("ACTIVE"), org.mockito.ArgumentMatchers.any(Pageable.class)))
            .thenReturn(Page.empty());

        var result = service.searchDirectory(" ", 3L, "ACTIVE", 0, 100);

        assertThat(result.content()).isEmpty();
        verify(empRepository).searchDirectoryWithoutKeyword(eq(3L), eq("ACTIVE"), org.mockito.ArgumentMatchers.any(Pageable.class));
    }

    @Test
    void directoryKeywordSearchUsesSystemAdminExcludedQuery() {
        when(empRepository.searchDirectory(eq("홍길동"), eq(null), eq("ACTIVE"), org.mockito.ArgumentMatchers.any(Pageable.class)))
            .thenReturn(Page.empty());

        var result = service.searchDirectory(" 홍길동 ", null, "ACTIVE", 0, 100);

        assertThat(result.content()).isEmpty();
        verify(empRepository).searchDirectory(eq("홍길동"), eq(null), eq("ACTIVE"), org.mockito.ArgumentMatchers.any(Pageable.class));
    }

    @Test
    void directoryAllStatusSearchIncludesEmploymentHistory() {
        when(empRepository.searchDirectoryWithoutKeyword(eq(null), eq(null), org.mockito.ArgumentMatchers.any(Pageable.class)))
            .thenReturn(Page.empty());

        var result = service.searchDirectory(null, null, "ALL", 0, 100);

        assertThat(result.content()).isEmpty();
        verify(empRepository).searchDirectoryWithoutKeyword(eq(null), eq(null), org.mockito.ArgumentMatchers.any(Pageable.class));
    }
}
