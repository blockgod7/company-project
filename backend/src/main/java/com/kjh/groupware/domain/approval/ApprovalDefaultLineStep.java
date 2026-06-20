package com.kjh.groupware.domain.approval;

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
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "approval_default_line_step")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalDefaultLineStep extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "default_line_step_id")
    private Long defaultLineStepId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "default_line_id", nullable = false)
    private ApprovalDefaultLine defaultLine;

    @Column(name = "step_order", nullable = false)
    private Integer stepOrder;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "approver_emp_id", nullable = false)
    private Emp approver;

    @Column(name = "line_type", nullable = false, length = 30)
    private String lineType;

    @Column(name = "required_yn", nullable = false, length = 1)
    private String requiredYn;

    @Column(name = "deleted_yn", nullable = false, length = 1)
    private String deletedYn;

    @Builder
    private ApprovalDefaultLineStep(
        ApprovalDefaultLine defaultLine,
        Integer stepOrder,
        Emp approver,
        String lineType,
        Boolean required,
        String deletedYn
    ) {
        this.defaultLine = defaultLine;
        this.stepOrder = stepOrder;
        this.approver = approver;
        this.lineType = lineType == null || lineType.isBlank() ? ApprovalLine.TYPE_APPROVAL : lineType;
        this.requiredYn = Boolean.FALSE.equals(required) ? "N" : "Y";
        this.deletedYn = deletedYn == null ? "N" : deletedYn;
    }
}
