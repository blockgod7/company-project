package com.kjh.groupware.domain.board;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BoardCommentRepository extends JpaRepository<BoardComment, Long> {

    List<BoardComment> findByPostAndDeletedYnOrderByCommentIdAsc(BoardPost post, String deletedYn);
}
