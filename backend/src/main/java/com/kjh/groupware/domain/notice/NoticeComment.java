package com.kjh.groupware.domain.notice;

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
@Table(name = "notice_comment")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NoticeComment extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "comment_id")
    private Long commentId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "notice_id", nullable = false)
    private Notice notice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "writer_emp_id", nullable = false)
    private Emp writer;

    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "deleted_yn", nullable = false, length = 1)
    private String deletedYn;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deleted_by")
    private Emp deletedBy;

    @Builder
    private NoticeComment(Notice notice, Emp writer, String content) {
        this.notice = notice;
        this.writer = writer;
        this.content = content;
        this.deletedYn = "N";
    }

    public void delete(Emp deletedBy) {
        this.deletedYn = "Y";
        this.deletedAt = LocalDateTime.now();
        this.deletedBy = deletedBy;
    }
}
