package com.kjh.groupware.domain.file;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttachFileRepository extends JpaRepository<AttachFile, Long> {

    List<AttachFile> findByTargetTypeAndTargetIdAndDeletedYnOrderByFileIdAsc(String targetType, Long targetId, String deletedYn);
}
