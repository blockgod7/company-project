package com.kjh.groupware.domain.board;

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
public class BoardPostReadId implements Serializable {

    @Column(name = "post_id")
    private Long postId;

    @Column(name = "emp_id")
    private Long empId;

    public BoardPostReadId(Long postId, Long empId) {
        this.postId = postId;
        this.empId = empId;
    }
}
