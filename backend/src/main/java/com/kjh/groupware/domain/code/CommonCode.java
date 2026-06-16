package com.kjh.groupware.domain.code;

import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(
    name = "common_code",
    uniqueConstraints = @UniqueConstraint(name = "uq_common_code", columnNames = {"code_group", "code"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CommonCode extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "code_id")
    private Long codeId;

    @Column(name = "code_group", nullable = false, length = 50)
    private String codeGroup;

    @Column(name = "code", nullable = false, length = 50)
    private String code;

    @Column(name = "code_name", nullable = false, length = 100)
    private String codeName;

    @Column(name = "description")
    private String description;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(name = "use_yn", nullable = false, length = 1)
    private String useYn;
}
