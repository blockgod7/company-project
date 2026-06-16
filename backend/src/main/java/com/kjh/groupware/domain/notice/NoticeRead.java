package com.kjh.groupware.domain.notice;

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
@Table(name = "notice_read")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NoticeRead {

    @EmbeddedId
    private NoticeReadId id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("noticeId")
    @JoinColumn(name = "notice_id", nullable = false)
    private Notice notice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @MapsId("empId")
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @CreationTimestamp
    @Column(name = "read_at", nullable = false, updatable = false)
    private LocalDateTime readAt;

    public NoticeRead(Notice notice, Emp emp) {
        this.id = new NoticeReadId(notice.getNoticeId(), emp.getEmpId());
        this.notice = notice;
        this.emp = emp;
    }
}
