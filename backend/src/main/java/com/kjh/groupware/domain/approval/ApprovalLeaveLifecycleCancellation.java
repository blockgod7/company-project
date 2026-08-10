package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.*;
import java.time.LocalDate;
import lombok.*;

@Entity
@Table(name = "approval_leave_lifecycle_cancellation")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalLeaveLifecycleCancellation extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "lifecycle_cancellation_id") private Long lifecycleCancellationId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "approval_id") private ApprovalDocument document;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "emp_id") private Emp emp;
    @Column(name = "leave_date", nullable = false) private LocalDate leaveDate;
    @Column(name = "leave_type", nullable = false, length = 50) private String leaveType;
    @Column(name = "cancellation_type", nullable = false, length = 30) private String cancellationType;
    @Column(name = "reason", nullable = false, length = 500) private String reason;
    @Column(name = "active_yn", nullable = false, length = 1) private String activeYn;

    public ApprovalLeaveLifecycleCancellation(ApprovalDocument document, LocalDate leaveDate, String leaveType, String cancellationType, String reason) {
        this.document = document; this.emp = document.getRequester(); this.leaveDate = leaveDate;
        this.leaveType = leaveType; this.cancellationType = cancellationType; this.reason = reason; this.activeYn = "Y";
    }
}
