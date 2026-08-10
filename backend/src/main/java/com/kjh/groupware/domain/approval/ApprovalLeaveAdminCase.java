package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "approval_leave_admin_case")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalLeaveAdminCase extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "leave_admin_case_id") private Long leaveAdminCaseId;
    @OneToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "approval_id", nullable = false, unique = true) private ApprovalDocument approval;
    @Column(name = "sick_pay_type", nullable = false, length = 20) private String sickPayType;
    @Column(name = "sick_pay_reason", length = 500) private String sickPayReason;
    @Column(name = "workers_comp_status", nullable = false, length = 30) private String workersCompStatus;
    @Column(name = "workers_comp_reason", length = 500) private String workersCompReason;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "last_managed_by") private Emp lastManagedBy;

    public ApprovalLeaveAdminCase(ApprovalDocument approval) {
        this.approval = approval;
        this.sickPayType = "UNPAID";
        this.workersCompStatus = "BEFORE_SUBMISSION";
    }

    public void updateSickPay(boolean paid, String reason, Emp actor) {
        sickPayType = paid ? "PAID" : "UNPAID";
        sickPayReason = reason;
        lastManagedBy = actor;
    }

    public void updateWorkersComp(String status, String reason, Emp actor) {
        workersCompStatus = status;
        workersCompReason = reason;
        lastManagedBy = actor;
    }
}
