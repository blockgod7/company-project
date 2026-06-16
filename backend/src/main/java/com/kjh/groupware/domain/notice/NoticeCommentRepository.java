package com.kjh.groupware.domain.notice;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NoticeCommentRepository extends JpaRepository<NoticeComment, Long> {

    List<NoticeComment> findByNoticeAndDeletedYnOrderByCommentIdAsc(Notice notice, String deletedYn);
}
