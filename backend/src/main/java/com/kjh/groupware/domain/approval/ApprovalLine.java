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
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "approval_line")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalLine extends BaseEntity {

    public static final String STATUS_WAITING = "WAITING";
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "line_id")
    private Long lineId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "approval_id", nullable = false)
    private ApprovalDocument document;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "approver_emp_id", nullable = false)
    private Emp approver;

    @Column(name = "line_order", nullable = false)
    private Integer lineOrder;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "comment", columnDefinition = "text")
    private String comment;

    @Column(name = "acted_at")
    private LocalDateTime actedAt;

    @Builder
    private ApprovalLine(ApprovalDocument document, Emp approver, Integer lineOrder, boolean first) {
        this.document = document;
        this.approver = approver;
        this.lineOrder = lineOrder;
        this.status = first ? STATUS_PENDING : STATUS_WAITING;
    }

    public boolean isPendingFor(Emp emp) {
        return STATUS_PENDING.equals(status) && approver.getEmpId().equals(emp.getEmpId());
    }

    public void approve(String comment) {
        this.status = STATUS_APPROVED;
        this.comment = comment;
        this.actedAt = LocalDateTime.now();
    }

    public void reject(String comment) {
        this.status = STATUS_REJECTED;
        this.comment = comment;
        this.actedAt = LocalDateTime.now();
    }

    public void open() {
        this.status = STATUS_PENDING;
    }
}
