package com.kjh.groupware.domain.board;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BoardRepository extends JpaRepository<Board, Long> {

    List<Board> findByUseYnOrderByBoardIdAsc(String useYn);

    Optional<Board> findByBoardCode(String boardCode);
}
