package com.kjh.groupware.domain.approval;

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
import java.math.BigDecimal;
import java.time.LocalDate;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "comp_time_allocation")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CompTimeAllocation extends BaseEntity {
    public static final String RESERVED = "RESERVED";
    public static final String USED = "USED";
    public static final String RELEASED = "RELEASED";
    public static final String RESTORED = "RESTORED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "allocation_id")
    private Long allocationId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "credit_id", nullable = false)
    private CompTimeCredit credit;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "approval_id", nullable = false)
    private ApprovalDocument approval;

    @Column(name = "leave_date", nullable = false)
    private LocalDate leaveDate;

    @Column(name = "allocated_days", nullable = false, precision = 3, scale = 1)
    private BigDecimal allocatedDays;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restored_by_approval_id")
    private ApprovalDocument restoredByApproval;

    @Column(name = "status_reason", length = 500)
    private String statusReason;

    public CompTimeAllocation(CompTimeCredit credit, ApprovalDocument approval, LocalDate leaveDate, BigDecimal allocatedDays) {
        this.credit = credit;
        this.approval = approval;
        this.leaveDate = leaveDate;
        this.allocatedDays = allocatedDays;
        this.status = RESERVED;
    }

    public void use() {
        requireStatus(RESERVED);
        credit.consume(allocatedDays);
        status = USED;
        statusReason = "최종 승인";
    }

    public void release(String reason) {
        requireStatus(RESERVED);
        credit.release(allocatedDays);
        status = RELEASED;
        statusReason = reason;
    }

    public void restore(ApprovalDocument cancelApproval, String reason) {
        requireStatus(USED);
        credit.restore(allocatedDays);
        status = RESTORED;
        restoredByApproval = cancelApproval;
        statusReason = reason;
    }

    public void reuse(String reason) {
        requireStatus(RESTORED);
        credit.reuse(allocatedDays);
        status = USED;
        restoredByApproval = null;
        statusReason = reason;
    }

    private void requireStatus(String expected) {
        if (!expected.equals(status)) {
            throw new IllegalStateException("Compensatory time allocation state is " + status + ", expected " + expected);
        }
    }
}
