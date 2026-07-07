package com.kjh.groupware.domain.notice;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NoticeRepository extends JpaRepository<Notice, Long> {

    List<Notice> findByDeletedYnOrderByPinnedYnDescNoticeIdDesc(String deletedYn);

    Page<Notice> findByDeletedYn(String deletedYn, Pageable pageable);

    @Query("""
        select n from Notice n
        where n.deletedYn = 'N'
          and (
            lower(n.title) like lower(concat('%', :keyword, '%'))
            or lower(n.content) like lower(concat('%', :keyword, '%'))
            or lower(n.writer.empName) like lower(concat('%', :keyword, '%'))
          )
        order by n.pinnedYn desc, n.noticeId desc
        """)
    Page<Notice> searchGlobal(@Param("keyword") String keyword, Pageable pageable);
}
