package com.kjh.groupware.domain.pdm;

import com.kjh.groupware.domain.emp.Emp;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PdmDownloadRequestRepository extends JpaRepository<PdmDownloadRequest, Long> {

    List<PdmDownloadRequest> findByRequesterOrderByRequestIdDesc(Emp requester);

    boolean existsByRevision(PdmDrawingRevision revision);
}
