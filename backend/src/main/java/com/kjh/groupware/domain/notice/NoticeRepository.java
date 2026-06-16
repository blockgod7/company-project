package com.kjh.groupware.domain.notice;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

    List<Notice> findByDeletedYnOrderByPinnedYnDescNoticeIdDesc(String deletedYn);

    Page<Notice> findByDeletedYn(String deletedYn, Pageable pageable);
}
