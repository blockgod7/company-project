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
import java.time.LocalDate;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "approval_delegation")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalDelegation extends BaseEntity {

    public static final String TYPE_MANUAL = "MANUAL";
    public static final String TYPE_DEFAULT = "DEFAULT";
    public static final String TYPE_AUTO = "AUTO";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "delegation_id")
    private Long delegationId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_emp_id", nullable = false)
    private Emp ownerEmp;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "delegate_emp_id", nullable = false)
    private Emp delegateEmp;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "start_at")
    private LocalDateTime startAt;

    @Column(name = "end_at")
    private LocalDateTime endAt;

    @Column(name = "delegation_type", nullable = false, length = 20)
    private String delegationType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_approval_id")
    private ApprovalDocument sourceApproval;

    @Column(name = "reason", columnDefinition = "text")
    private String reason;

    @Column(name = "active_yn", nullable = false, length = 1)
    private String activeYn;

    @Column(name = "deleted_yn", nullable = false, length = 1)
    private String deletedYn;

    @Builder
    private ApprovalDelegation(
        Emp ownerEmp,
        Emp delegateEmp,
        LocalDate startDate,
        LocalDate endDate,
        LocalDateTime startAt,
        LocalDateTime endAt,
        String delegationType,
        ApprovalDocument sourceApproval,
        String reason,
        String activeYn
    ) {
        this.ownerEmp = ownerEmp;
        this.delegateEmp = delegateEmp;
        this.startDate = startDate == null ? LocalDate.now() : startDate;
        this.endDate = endDate;
        this.startAt = startAt;
        this.endAt = endAt;
        this.delegationType = delegationType == null || delegationType.isBlank() ? TYPE_MANUAL : delegationType;
        this.sourceApproval = sourceApproval;
        this.reason = reason;
        this.activeYn = activeYn == null || activeYn.isBlank() ? "Y" : activeYn;
        this.deletedYn = "N";
    }

    public void update(Emp delegateEmp, LocalDate startDate, LocalDate endDate, String reason, boolean active) {
        this.delegateEmp = delegateEmp;
        this.startDate = startDate == null ? LocalDate.now() : startDate;
        this.endDate = endDate;
        this.startAt = null;
        this.endAt = null;
        this.reason = reason;
        this.activeYn = active ? "Y" : "N";
        this.deletedYn = "N";
    }

    public void updateDefault(Emp delegateEmp, String reason) {
        this.delegateEmp = delegateEmp;
        this.startDate = LocalDate.now();
        this.endDate = null;
        this.startAt = null;
        this.endAt = null;
        this.delegationType = TYPE_DEFAULT;
        this.sourceApproval = null;
        this.reason = reason;
        this.activeYn = "Y";
        this.deletedYn = "N";
    }

    public void deactivate() {
        this.activeYn = "N";
    }

    public void delete() {
        this.activeYn = "N";
        this.deletedYn = "Y";
    }

    public boolean isActiveOn(LocalDate date) {
        LocalDate target = date == null ? LocalDate.now() : date;
        return "Y".equals(activeYn)
            && "N".equals(deletedYn)
            && !TYPE_DEFAULT.equals(delegationType)
            && !startDate.isAfter(target)
            && (endDate == null || !endDate.isBefore(target));
    }

    public boolean isActiveAt(LocalDateTime dateTime) {
        LocalDateTime target = dateTime == null ? LocalDateTime.now() : dateTime;
        if (!"Y".equals(activeYn) || !"N".equals(deletedYn) || TYPE_DEFAULT.equals(delegationType)) {
            return false;
        }
        if (startAt != null || endAt != null) {
            return (startAt == null || !startAt.isAfter(target))
                && (endAt == null || endAt.isAfter(target));
        }
        return isActiveOn(target.toLocalDate());
    }
}
