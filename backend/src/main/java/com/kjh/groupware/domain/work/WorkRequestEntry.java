package com.kjh.groupware.domain.work;

import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.domain.dept.Dept;
import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "work_request_entry")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkRequestEntry extends BaseEntity {
    public static final String PENDING = "PENDING";
    public static final String PLANNED = "PLANNED";
    public static final String COMPLETED = "COMPLETED";
    public static final String CANCEL_PENDING = "CANCEL_PENDING";
    public static final String CANCELED = "CANCELED";

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "work_entry_id") private Long workEntryId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "approval_id") private ApprovalDocument approval;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "emp_id") private Emp emp;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "requester_emp_id") private Emp requester;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "dept_id") private Dept dept;
    @Column(name = "emp_name_snapshot", nullable = false, length = 100) private String empNameSnapshot;
    @Column(name = "dept_name_snapshot", length = 100) private String deptNameSnapshot;
    @Column(name = "work_category_snapshot", nullable = false, length = 20) private String workCategorySnapshot;
    @Column(name = "shift_type_snapshot", length = 20) private String shiftTypeSnapshot;
    @Column(name = "shift_anchor_date_snapshot") private LocalDate shiftAnchorDateSnapshot;
    @Column(name = "work_type", nullable = false, length = 30) private String workType;
    @Column(name = "work_date", nullable = false) private LocalDate workDate;
    @Column(name = "start_time", nullable = false) private LocalTime startTime;
    @Column(name = "end_time", nullable = false) private LocalTime endTime;
    @Column(name = "work_minutes", nullable = false) private Integer workMinutes;
    @Column(name = "work_content", nullable = false, length = 1000) private String workContent;
    @Column(name = "comp_time_yn", nullable = false, length = 1) private String compTimeYn;
    @Column(name = "status", nullable = false, length = 20) private String status;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "canceled_by_approval_id") private ApprovalDocument canceledByApproval;

    public WorkRequestEntry(ApprovalDocument approval, Emp emp, Emp requester, String workType, LocalDate workDate,
                            LocalTime startTime, LocalTime endTime, int workMinutes, String workContent, boolean compTime) {
        this.approval = approval; this.emp = emp; this.requester = requester; this.dept = emp.getDept();
        this.empNameSnapshot = emp.getEmpName();
        this.deptNameSnapshot = emp.getDept() == null ? null : emp.getDept().getDeptName();
        this.workCategorySnapshot = emp.getWorkCategory(); this.shiftTypeSnapshot = emp.getShiftType(); this.shiftAnchorDateSnapshot = emp.getShiftAnchorDate();
        this.workType = workType; this.workDate = workDate; this.startTime = startTime; this.endTime = endTime;
        this.workMinutes = workMinutes; this.workContent = workContent; this.compTimeYn = compTime ? "Y" : "N";
        this.status = PENDING;
    }

    public LocalDateTime scheduledEnd() {
        return workDate.atTime(endTime).plusDays(endTime.isAfter(startTime) ? 0 : 1);
    }
    public boolean hasEndedAt(LocalDateTime now) { return !scheduledEnd().isAfter(now); }
    public void approve(LocalDateTime now) { status = hasEndedAt(now) ? COMPLETED : PLANNED; }
    public void complete(LocalDateTime now) { if (PLANNED.equals(status) && hasEndedAt(now)) status = COMPLETED; }
    public void markCancelPending() { status = CANCEL_PENDING; }
    public void restoreAfterChange(LocalDateTime now) { if (CANCEL_PENDING.equals(status)) approve(now); }
    public void cancel(ApprovalDocument changeApproval) { status = CANCELED; canceledByApproval = changeApproval; }
}
