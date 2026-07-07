package com.kjh.groupware.domain.board;

import java.util.List;
import com.kjh.groupware.domain.emp.Emp;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BoardPostRepository extends JpaRepository<BoardPost, Long> {

    List<BoardPost> findByBoardAndDeletedYnOrderByPostIdDesc(Board board, String deletedYn);

    Page<BoardPost> findByBoardAndDeletedYn(Board board, String deletedYn, Pageable pageable);

    @Query("""
        select p from BoardPost p
        where p.deletedYn = 'N'
          and p.board.useYn = 'Y'
          and (p.draftYn = 'N' or :admin = true or p.writer = :currentEmp)
          and (
            lower(p.title) like lower(concat('%', :keyword, '%'))
            or lower(p.content) like lower(concat('%', :keyword, '%'))
            or lower(p.writer.empName) like lower(concat('%', :keyword, '%'))
            or lower(p.board.boardName) like lower(concat('%', :keyword, '%'))
          )
        order by p.postId desc
        """)
    Page<BoardPost> searchGlobal(
        @Param("keyword") String keyword,
        @Param("currentEmp") Emp currentEmp,
        @Param("admin") boolean admin,
        Pageable pageable
    );
}
