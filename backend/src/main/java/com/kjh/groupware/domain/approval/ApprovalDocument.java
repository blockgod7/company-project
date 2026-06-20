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
@Table(name = "approval_document")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalDocument extends BaseEntity {

    public static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
    public static final String STATUS_PENDING = STATUS_IN_PROGRESS;
    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";
    public static final String STATUS_WITHDRAWN = "WITHDRAWN";
    public static final String STATUS_CANCELED = "CANCELED";
    public static final String STAGE_DRAFT = "DRAFT";
    public static final String STAGE_AGREEMENT_PROGRESS = "AGREEMENT_PROGRESS";
    public static final String STAGE_APPROVAL_PROGRESS = "APPROVAL_PROGRESS";
    public static final String STAGE_RECEIVER_PROGRESS = "RECEIVER_PROGRESS";
    public static final String STAGE_COMPLETED = "COMPLETED";
    public static final String STAGE_REJECTED = "REJECTED";
    public static final String STAGE_WITHDRAWN = "WITHDRAWN";
    public static final String STAGE_CANCELED = "CANCELED";
    public static final String PRIORITY_NORMAL = "NORMAL";
    public static final String PDF_STATUS_NONE = "NONE";
    public static final String PDF_STATUS_GENERATING = "GENERATING";
    public static final String PDF_STATUS_GENERATED = "GENERATED";
    public static final String PDF_STATUS_FAILED = "FAILED";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "approval_id")
    private Long approvalId;

    @Column(name = "title", nullable = false, length = 200)
    private String title;

    @Column(name = "content", nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "document_no", unique = true, length = 50)
    private String documentNo;

    @Column(name = "template_code", length = 50)
    private String templateCode;

    @Column(name = "template_version")
    private Integer templateVersion;

    @Column(name = "template_snapshot_json", columnDefinition = "text")
    private String templateSnapshotJson;

    @Column(name = "form_data_json", columnDefinition = "text")
    private String formDataJson;

    @Column(name = "content_snapshot_json", columnDefinition = "text")
    private String contentSnapshotJson;

    @Column(name = "approval_line_snapshot_json", columnDefinition = "text")
    private String approvalLineSnapshotJson;

    @Column(name = "signature_snapshot_json", columnDefinition = "text")
    private String signatureSnapshotJson;

    @Column(name = "search_text", columnDefinition = "text")
    private String searchText;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "correction_of_approval_id")
    private ApprovalDocument correctionOfApproval;

    @Column(name = "correction_reason", columnDefinition = "text")
    private String correctionReason;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "origin_document_id")
    private ApprovalDocument originDocument;

    @Column(name = "revision_no", nullable = false)
    private Integer revisionNo;

    @Column(name = "resubmit_reason", columnDefinition = "text")
    private String resubmitReason;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_emp_id", nullable = false)
    private Emp requester;

    @Column(name = "draft_dept_id")
    private Long draftDeptId;

    @Column(name = "draft_dept_code", length = 50)
    private String draftDeptCode;

    @Column(name = "draft_dept_name", length = 100)
    private String draftDeptName;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "current_stage", nullable = false, length = 50)
    private String currentStage;

    @Column(name = "priority", nullable = false, length = 30)
    private String priority;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "first_submitted_at")
    private LocalDateTime firstSubmittedAt;

    @Column(name = "last_submitted_at")
    private LocalDateTime lastSubmittedAt;

    @Column(name = "submit_count", nullable = false)
    private Integer submitCount;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "withdrawn_at")
    private LocalDateTime withdrawnAt;

    @Column(name = "withdraw_reason", columnDefinition = "text")
    private String withdrawReason;

    @Column(name = "pdf_status", nullable = false, length = 20)
    private String pdfStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pdf_file_id")
    private com.kjh.groupware.domain.file.AttachFile pdfFile;

    @Column(name = "pdf_generated_at")
    private LocalDateTime pdfGeneratedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pdf_generated_by")
    private Emp pdfGeneratedBy;

    @Column(name = "pdf_error_message", columnDefinition = "text")
    private String pdfErrorMessage;

    @Column(name = "pdf_hash", length = 128)
    private String pdfHash;

    @Column(name = "deleted_yn", nullable = false, length = 1)
    private String deletedYn;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deleted_by")
    private Emp deletedBy;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Builder
    private ApprovalDocument(
        String title,
        String content,
        String documentNo,
        String templateCode,
        Integer templateVersion,
        String templateSnapshotJson,
        String formDataJson,
        String searchText,
        String priority,
        ApprovalDocument originDocument,
        Integer revisionNo,
        String resubmitReason,
        Emp requester
    ) {
        this.title = title;
        this.content = content;
        this.documentNo = documentNo;
        this.templateCode = templateCode;
        this.templateVersion = templateVersion;
        this.templateSnapshotJson = templateSnapshotJson;
        this.formDataJson = formDataJson;
        this.searchText = searchText;
        this.originDocument = originDocument;
        this.revisionNo = revisionNo == null ? 0 : revisionNo;
        this.resubmitReason = resubmitReason;
        this.requester = requester;
        this.status = STATUS_DRAFT;
        this.currentStage = STAGE_DRAFT;
        this.priority = priority == null || priority.isBlank() ? PRIORITY_NORMAL : priority;
        this.pdfStatus = PDF_STATUS_NONE;
        this.requestedAt = LocalDateTime.now();
        this.submitCount = 0;
        this.deletedYn = "N";
        snapshotDraftDept(requester);
    }

    public boolean isPending() {
        return STATUS_PENDING.equals(status);
    }

    public boolean isDraft() {
        return STATUS_DRAFT.equals(status);
    }

    public boolean isEditableDraft() {
        return STATUS_DRAFT.equals(status) || STATUS_WITHDRAWN.equals(status);
    }

    public void saveAsDraft() {
        this.status = STATUS_DRAFT;
        this.currentStage = STAGE_DRAFT;
        this.completedAt = null;
    }

    public void updateDraft(
        String title,
        String content,
        String templateCode,
        Integer templateVersion,
        String templateSnapshotJson,
        String formDataJson,
        String searchText,
        String priority
    ) {
        this.title = title;
        this.content = content;
        this.templateCode = templateCode;
        this.templateVersion = templateVersion;
        this.templateSnapshotJson = templateSnapshotJson;
        this.formDataJson = formDataJson;
        this.searchText = searchText;
        this.priority = priority == null || priority.isBlank() ? PRIORITY_NORMAL : priority;
        this.completedAt = null;
    }

    public void submit(String documentNo, String searchText, boolean hasAgreement) {
        if (this.documentNo == null || this.documentNo.isBlank()) {
            this.documentNo = documentNo;
        }
        this.status = STATUS_IN_PROGRESS;
        this.currentStage = hasAgreement ? STAGE_AGREEMENT_PROGRESS : STAGE_APPROVAL_PROGRESS;
        this.searchText = searchText;
        LocalDateTime now = LocalDateTime.now();
        this.requestedAt = now;
        this.lastSubmittedAt = now;
        if (this.firstSubmittedAt == null) {
            this.firstSubmittedAt = now;
        }
        this.submitCount = this.submitCount == null ? 1 : this.submitCount + 1;
        this.completedAt = null;
        this.withdrawnAt = null;
        this.withdrawReason = null;
    }

    public void moveToApprovalProgress() {
        this.currentStage = STAGE_APPROVAL_PROGRESS;
    }

    public void approve() {
        this.status = STATUS_APPROVED;
        this.currentStage = STAGE_COMPLETED;
        this.completedAt = LocalDateTime.now();
    }

    public void reject() {
        this.status = STATUS_REJECTED;
        this.currentStage = STAGE_REJECTED;
        this.completedAt = LocalDateTime.now();
    }

    public void withdraw(String reason) {
        this.status = STATUS_WITHDRAWN;
        this.currentStage = STAGE_WITHDRAWN;
        this.withdrawnAt = LocalDateTime.now();
        this.withdrawReason = reason;
        this.completedAt = this.withdrawnAt;
    }

    public void cancel() {
        this.status = STATUS_CANCELED;
        this.currentStage = STAGE_CANCELED;
        this.completedAt = LocalDateTime.now();
    }

    public void delete(Emp deletedBy) {
        this.deletedYn = "Y";
        this.deletedAt = LocalDateTime.now();
        this.deletedBy = deletedBy;
    }

    public boolean isLocked() {
        return STATUS_APPROVED.equals(status);
    }

    public void setSnapshotJson(String contentSnapshotJson, String approvalLineSnapshotJson, String signatureSnapshotJson) {
        this.contentSnapshotJson = contentSnapshotJson;
        this.approvalLineSnapshotJson = approvalLineSnapshotJson;
        this.signatureSnapshotJson = signatureSnapshotJson;
    }

    private void snapshotDraftDept(Emp requester) {
        if (requester == null || requester.getDept() == null) {
            return;
        }
        this.draftDeptId = requester.getDept().getDeptId();
        this.draftDeptCode = requester.getDept().getDeptCode();
        this.draftDeptName = requester.getDept().getDeptName();
    }

    public void startPdfGeneration() {
        this.pdfStatus = PDF_STATUS_GENERATING;
        this.pdfErrorMessage = null;
    }

    public void completePdfGeneration(com.kjh.groupware.domain.file.AttachFile pdfFile, String pdfHash) {
        this.pdfStatus = PDF_STATUS_GENERATED;
        this.pdfFile = pdfFile;
        this.pdfHash = pdfHash;
        this.pdfGeneratedAt = LocalDateTime.now();
        this.pdfErrorMessage = null;
    }

    public void failPdfGeneration(String message) {
        this.pdfStatus = PDF_STATUS_FAILED;
        this.pdfErrorMessage = message == null ? "PDF generation failed" : message;
    }
}
