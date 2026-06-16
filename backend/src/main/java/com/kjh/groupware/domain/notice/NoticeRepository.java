package com.kjh.groupware.domain.notice;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

    List<Notice> findByDeletedYnOrderByPinnedYnDescNoticeIdDesc(String deletedYn);
}
