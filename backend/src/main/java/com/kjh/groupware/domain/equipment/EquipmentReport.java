package com.kjh.groupware.domain.equipment;

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
import java.math.BigDecimal;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "equipment_report")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EquipmentReport extends BaseEntity {
    public static final String PENDING_INITIAL_APPROVAL = "PENDING_INITIAL_APPROVAL";
    public static final String ASSIGNMENT_PENDING = "ASSIGNMENT_PENDING";
    public static final String IN_PROGRESS = "IN_PROGRESS";
    public static final String PENDING_COMPLETION_APPROVAL = "PENDING_COMPLETION_APPROVAL";
    public static final String REWORK = "REWORK";
    public static final String COMPLETED = "COMPLETED";
    public static final String REJECTED = "REJECTED";

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "report_id") private Long reportId;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "equipment_id", nullable = false) private Equipment equipment;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "reporter_emp_id", nullable = false) private Emp reporter;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "assignee_emp_id") private Emp assignee;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "assigned_by_emp_id") private Emp assignedBy;
    @Column(name = "title", nullable = false, length = 200) private String title;
    @Column(name = "symptom", nullable = false, columnDefinition = "text") private String symptom;
    @Column(name = "request_content", nullable = false, columnDefinition = "text") private String requestContent;
    @Column(name = "priority", nullable = false, length = 20) private String priority;
    @Column(name = "occurred_on") private LocalDate occurredOn;
    @Column(name = "planned_start_on") private LocalDate plannedStartOn;
    @Column(name = "planned_end_on") private LocalDate plannedEndOn;
    @Column(name = "assignment_instruction", columnDefinition = "text") private String assignmentInstruction;
    @Column(name = "work_result", columnDefinition = "text") private String workResult;
    @Column(name = "cause_analysis", columnDefinition = "text") private String causeAnalysis;
    @Column(name = "action_taken", columnDefinition = "text") private String actionTaken;
    @Column(name = "completed_on") private LocalDate completedOn;
    @Column(name = "work_duration_hours", precision = 6, scale = 2) private BigDecimal workDurationHours;
    @Column(name = "state", nullable = false, length = 40) private String state;
    @Column(name = "initial_approval_id") private Long initialApprovalId;
    @Column(name = "completion_approval_id") private Long completionApprovalId;

    public EquipmentReport(Equipment equipment, Emp reporter, String title, String symptom, String requestContent, String priority, LocalDate occurredOn) {
        this.equipment = equipment; this.reporter = reporter; this.title = title; this.symptom = symptom;
        this.requestContent = requestContent; this.priority = priority == null || priority.isBlank() ? "NORMAL" : priority;
        this.occurredOn = occurredOn; this.state = PENDING_INITIAL_APPROVAL;
    }
    public void linkInitialApproval(Long approvalId) { this.initialApprovalId = approvalId; }
    public void assign(Emp manager, Emp assignee, LocalDate start, LocalDate end, String instruction) {
        this.assignedBy = manager; this.assignee = assignee; this.plannedStartOn = start; this.plannedEndOn = end;
        this.assignmentInstruction = instruction; this.state = IN_PROGRESS;
    }
    public void submitCompletion(String workResult, String causeAnalysis, String actionTaken, LocalDate completedOn, BigDecimal workDurationHours, Long approvalId) {
        this.workResult = workResult; this.causeAnalysis = causeAnalysis; this.actionTaken = actionTaken;
        this.completedOn = completedOn; this.workDurationHours = workDurationHours;
        this.completionApprovalId = approvalId; this.state = PENDING_COMPLETION_APPROVAL;
    }
    public void initialApproved() { this.state = ASSIGNMENT_PENDING; }
    public void initialRejected() { this.state = REJECTED; }
    public void completionApproved() { this.state = COMPLETED; }
    public void completionRejected() { this.state = REWORK; }
}
