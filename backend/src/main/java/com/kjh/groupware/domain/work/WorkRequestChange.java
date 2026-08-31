package com.kjh.groupware.domain.work;

import com.kjh.groupware.domain.approval.ApprovalDocument;
import com.kjh.groupware.global.entity.BaseEntity;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "work_request_change")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class WorkRequestChange extends BaseEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "work_change_id") private Long workChangeId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "approval_id") private ApprovalDocument approval;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "source_work_entry_id") private WorkRequestEntry source;
    @Column(name = "action_type", nullable = false, length = 20) private String actionType;
    @Column(name = "new_work_date") private LocalDate newWorkDate;
    @Column(name = "new_start_time") private LocalTime newStartTime;
    @Column(name = "new_end_time") private LocalTime newEndTime;
    @Column(name = "new_work_content", length = 1000) private String newWorkContent;
    @Column(name = "new_comp_time_yn", length = 1) private String newCompTimeYn;
    @Column(name = "reason", nullable = false, length = 1000) private String reason;
    @Column(name = "status", nullable = false, length = 20) private String status;

    public WorkRequestChange(ApprovalDocument approval, WorkRequestEntry source, String actionType, LocalDate date,
                             LocalTime start, LocalTime end, String content, Boolean compTime, String reason) {
        this.approval = approval; this.source = source; this.actionType = actionType; this.newWorkDate = date;
        this.newStartTime = start; this.newEndTime = end; this.newWorkContent = content;
        this.newCompTimeYn = compTime == null ? null : (compTime ? "Y" : "N"); this.reason = reason; this.status = "PENDING";
    }
    public void approve() { status = "APPROVED"; }
    public void resolve(boolean rejected) { status = rejected ? "REJECTED" : "WITHDRAWN"; }
}
