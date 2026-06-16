package com.kjh.groupware.domain.board;

import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BoardPostRepository extends JpaRepository<BoardPost, Long> {

    List<BoardPost> findByBoardAndDeletedYnOrderByPostIdDesc(Board board, String deletedYn);

    Page<BoardPost> findByBoardAndDeletedYn(Board board, String deletedYn, Pageable pageable);
}
