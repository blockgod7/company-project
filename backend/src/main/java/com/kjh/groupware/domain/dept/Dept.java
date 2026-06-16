package com.kjh.groupware.domain.dept;

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
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "dept")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Dept extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "dept_id")
    private Long deptId;

    @Column(name = "dept_code", nullable = false, unique = true, length = 30)
    private String deptCode;

    @Column(name = "dept_name", nullable = false, length = 100)
    private String deptName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_dept_id")
    private Dept parentDept;

    @Column(name = "sort_order")
    private Integer sortOrder;

    @Column(name = "use_yn", nullable = false, length = 1)
    private String useYn;
}
