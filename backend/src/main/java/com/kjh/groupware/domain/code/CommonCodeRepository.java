package com.kjh.groupware.domain.code;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommonCodeRepository extends JpaRepository<CommonCode, Long> {

    List<CommonCode> findByCodeGroupAndUseYnOrderBySortOrderAsc(String codeGroup, String useYn);

    Optional<CommonCode> findByCodeGroupAndCode(String codeGroup, String code);
}
