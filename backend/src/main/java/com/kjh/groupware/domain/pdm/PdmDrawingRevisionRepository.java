package com.kjh.groupware.domain.pdm;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PdmDrawingRevisionRepository extends JpaRepository<PdmDrawingRevision, Long> {

    List<PdmDrawingRevision> findByDrawingOrderByRevisionOrderDescRevisionIdDesc(PdmDrawing drawing);
}
