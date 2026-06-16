package com.kjh.groupware.domain.board;

import com.kjh.groupware.domain.emp.Emp;
import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "board_post_read")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BoardPostRead {

    @EmbeddedId
    private BoardPostReadId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("postId")
    @JoinColumn(name = "post_id", nullable = false)
    private BoardPost post;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("empId")
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @CreationTimestamp
    @Column(name = "read_at", nullable = false, updatable = false)
    private LocalDateTime readAt;

    public BoardPostRead(BoardPost post, Emp emp) {
        this.id = new BoardPostReadId(post.getPostId(), emp.getEmpId());
        this.post = post;
        this.emp = emp;
    }
}
