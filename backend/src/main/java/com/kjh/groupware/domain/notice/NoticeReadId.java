package com.kjh.groupware.domain.notice;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AccessLevel;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Embeddable
@EqualsAndHashCode
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NoticeReadId implements Serializable {

    @Column(name = "notice_id")
    private Long noticeId;

    @Column(name = "emp_id")
    private Long empId;

    public NoticeReadId(Long noticeId, Long empId) {
        this.noticeId = noticeId;
        this.empId = empId;
    }
}
