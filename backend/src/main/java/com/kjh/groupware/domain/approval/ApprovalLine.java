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
import jakarta.persistence.Version;
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
    public static final String STATUS_SKIPPED = "SKIPPED";
    public static final String STATUS_RECEIVED = "RECEIVED";
    public static final String STATUS_READ = "READ";
    public static final String STATUS_RECEIPT_COMPLETED = "RECEIPT_COMPLETED";
    public static final String TYPE_AGREEMENT = "AGREEMENT";
    public static final String TYPE_APPROVAL = "APPROVAL";
    public static final String TYPE_RECEIVER = "RECEIVER";
    public static final String TYPE_REFERENCE = "REFERENCE";
    public static final String TYPE_READER = "READER";

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

    @Column(name = "line_type", nullable = false, length = 30)
    private String lineType;

    @Column(name = "target_type", length = 30)
    private String targetType;

    @Column(name = "target_id")
    private Long targetId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_emp_id")
    private Emp assignedEmp;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "acted_emp_id")
    private Emp actedEmp;

    @Column(name = "line_order", nullable = false)
    private Integer lineOrder;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "comment", columnDefinition = "text")
    private String comment;

    @Column(name = "acted_at")
    private LocalDateTime actedAt;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(name = "reminded_at")
    private LocalDateTime remindedAt;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @Column(name = "emp_no_snapshot", length = 50)
    private String empNoSnapshot;

    @Column(name = "emp_name_snapshot", length = 100)
    private String empNameSnapshot;

    @Column(name = "dept_id_snapshot")
    private Long deptIdSnapshot;

    @Column(name = "dept_code_snapshot", length = 50)
    private String deptCodeSnapshot;

    @Column(name = "dept_name_snapshot", length = 100)
    private String deptNameSnapshot;

    @Column(name = "position_snapshot", length = 100)
    private String positionSnapshot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sign_image_file_id")
    private com.kjh.groupware.domain.file.AttachFile signImageFile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sign_snapshot_file_id")
    private com.kjh.groupware.domain.file.AttachFile signSnapshotFile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signature_snapshot_file_id")
    private com.kjh.groupware.domain.file.AttachFile signatureSnapshotFile;

    @Column(name = "signature_snapshot_json", columnDefinition = "text")
    private String signatureSnapshotJson;

    @Column(name = "signed_at")
    private LocalDateTime signedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Builder
    private ApprovalLine(ApprovalDocument document, Emp approver, String lineType, Integer lineOrder, boolean first) {
        this.document = document;
        this.approver = approver;
        this.assignedEmp = approver;
        this.lineType = lineType == null || lineType.isBlank() ? TYPE_APPROVAL : lineType;
        this.targetType = "EMPLOYEE";
        this.targetId = approver == null ? null : approver.getEmpId();
        this.lineOrder = lineOrder;
        this.status = first ? STATUS_PENDING : STATUS_WAITING;
        snapshotAssignee(approver);
    }

    public boolean isPendingFor(Emp emp) {
        return STATUS_PENDING.equals(status) && assignedEmp != null && assignedEmp.getEmpId().equals(emp.getEmpId());
    }

    public boolean isAssignedTo(Emp emp) {
        return assignedEmp != null && emp != null && assignedEmp.getEmpId().equals(emp.getEmpId());
    }

    public boolean isAgreement() {
        return TYPE_AGREEMENT.equals(lineType);
    }

    public boolean isApproval() {
        return TYPE_APPROVAL.equals(lineType);
    }

    public boolean isReceiver() {
        return TYPE_RECEIVER.equals(lineType);
    }

    public boolean isReference() {
        return TYPE_REFERENCE.equals(lineType);
    }

    public boolean isReader() {
        return TYPE_READER.equals(lineType);
    }

    public boolean isDecisionLine() {
        return isAgreement() || isApproval();
    }

    public void approve(Emp actedEmp, String comment, com.kjh.groupware.domain.file.AttachFile signatureSnapshotFile, String signatureSnapshotJson) {
        this.status = STATUS_APPROVED;
        this.comment = comment;
        this.actedAt = LocalDateTime.now();
        this.signedAt = this.actedAt;
        this.actedEmp = actedEmp == null ? this.assignedEmp : actedEmp;
        this.signatureSnapshotFile = signatureSnapshotFile;
        this.signatureSnapshotJson = signatureSnapshotJson;
        this.signSnapshotFile = signatureSnapshotFile;
    }

    public void reject(Emp actedEmp, String comment) {
        this.status = STATUS_REJECTED;
        this.comment = comment;
        this.actedAt = LocalDateTime.now();
        this.actedEmp = actedEmp == null ? this.assignedEmp : actedEmp;
    }

    public void open() {
        open(null);
    }

    public void open(LocalDateTime dueAt) {
        this.status = STATUS_PENDING;
        this.actedAt = null;
        this.comment = null;
        this.dueAt = dueAt;
        this.remindedAt = null;
    }

    public void reassign(Emp assignee) {
        this.assignedEmp = assignee;
        this.targetId = assignee == null ? null : assignee.getEmpId();
    }

    public boolean isActed() {
        return STATUS_APPROVED.equals(status)
            || STATUS_REJECTED.equals(status)
            || STATUS_RECEIVED.equals(status)
            || STATUS_READ.equals(status)
            || STATUS_RECEIPT_COMPLETED.equals(status);
    }

    public void skip(String comment) {
        this.status = STATUS_SKIPPED;
        this.comment = comment;
        this.actedAt = LocalDateTime.now();
    }

    public void markReceived() {
        this.status = STATUS_RECEIVED;
    }

    public void openShared() {
        this.status = STATUS_READ;
    }

    public void markRead() {
        this.status = STATUS_READ;
        this.readAt = LocalDateTime.now();
    }

    public void completeReceipt(Emp actedEmp, String comment) {
        this.status = STATUS_RECEIPT_COMPLETED;
        this.comment = comment;
        this.actedAt = LocalDateTime.now();
        this.actedEmp = actedEmp == null ? this.assignedEmp : actedEmp;
    }

    public boolean isOverdueForReminder(LocalDateTime now) {
        return STATUS_PENDING.equals(status)
            && dueAt != null
            && dueAt.isBefore(now == null ? LocalDateTime.now() : now)
            && remindedAt == null;
    }

    public void markReminded() {
        this.remindedAt = LocalDateTime.now();
    }

    private void snapshotAssignee(Emp assignee) {
        if (assignee == null) {
            return;
        }
        this.empNoSnapshot = assignee.getEmpNo();
        this.empNameSnapshot = assignee.getEmpName();
        this.positionSnapshot = assignee.getPositionName();
        if (assignee.getDept() != null) {
            this.deptIdSnapshot = assignee.getDept().getDeptId();
            this.deptCodeSnapshot = assignee.getDept().getDeptCode();
            this.deptNameSnapshot = assignee.getDept().getDeptName();
        }
    }
}
