package com.kjh.groupware.domain.board;

import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "board")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Board extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "board_id")
    private Long boardId;

    @Column(name = "board_code", nullable = false, unique = true, length = 50)
    private String boardCode;

    @Column(name = "board_name", nullable = false, length = 100)
    private String boardName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dept_id")
    private Dept dept;

    @Column(name = "use_yn", nullable = false, length = 1)
    private String useYn;

    @Builder
    private Board(String boardCode, String boardName, Dept dept) {
        this.boardCode = boardCode;
        this.boardName = boardName;
        this.dept = dept;
        this.useYn = "Y";
    }
}
