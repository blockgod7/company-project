package com.kjh.groupware.domain.board;

import com.kjh.groupware.domain.emp.Emp;
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
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "board_post")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BoardPost extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "post_id")
    private Long postId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "board_id", nullable = false)
    private Board board;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "writer_emp_id", nullable = false)
    private Emp writer;

    @Column(name = "view_count", nullable = false)
    private Integer viewCount;

    @Column(name = "draft_yn", nullable = false, length = 1)
    private String draftYn;

    @Column(name = "deleted_yn", nullable = false, length = 1)
    private String deletedYn;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deleted_by")
    private Emp deletedBy;

    @Builder
    private BoardPost(Board board, String title, String content, Emp writer, boolean draft) {
        this.board = board;
        this.title = title;
        this.content = content;
        this.writer = writer;
        this.viewCount = 0;
        this.draftYn = draft ? "Y" : "N";
        this.deletedYn = "N";
    }

    public void update(String title, String content, boolean draft) {
        this.title = title;
        this.content = content;
        this.draftYn = draft ? "Y" : "N";
    }

    public void increaseViewCount() {
        this.viewCount = this.viewCount == null ? 1 : this.viewCount + 1;
    }

    public void delete(Emp deletedBy) {
        this.deletedYn = "Y";
        this.deletedAt = LocalDateTime.now();
        this.deletedBy = deletedBy;
    }
}
