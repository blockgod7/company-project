package com.kjh.groupware.domain.pdm;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PdmFolderRepository extends JpaRepository<PdmFolder, Long> {

    List<PdmFolder> findAllByOrderByCategoryAscCompanyNameAscProjectNameAscBusinessUnitAscProcessNameAscFolderKindAscSortOrderAscFolderNameAsc();
}
