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
@Table(name = "approval_document")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalDocument extends BaseEntity {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";
    public static final String STATUS_WITHDRAWN = "WITHDRAWN";
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

    @Column(name = "document_no", nullable = false, unique = true, length = 30)
    private String documentNo;

    @Column(name = "template_code", length = 50)
    private String templateCode;

    @Column(name = "template_version")
    private Integer templateVersion;

    @Column(name = "template_snapshot_json", columnDefinition = "text")
    private String templateSnapshotJson;

    @Column(name = "form_data_json", columnDefinition = "text")
    private String formDataJson;

    @Column(name = "search_text", columnDefinition = "text")
    private String searchText;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "correction_of_approval_id")
    private ApprovalDocument correctionOfApproval;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_emp_id", nullable = false)
    private Emp requester;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "pdf_status", nullable = false, length = 20)
    private String pdfStatus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pdf_file_id")
    private com.kjh.groupware.domain.file.AttachFile pdfFile;

    @Column(name = "pdf_generated_at")
    private LocalDateTime pdfGeneratedAt;

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
        this.requester = requester;
        this.status = STATUS_PENDING;
        this.pdfStatus = PDF_STATUS_NONE;
        this.requestedAt = LocalDateTime.now();
        this.deletedYn = "N";
    }

    public boolean isPending() {
        return STATUS_PENDING.equals(status);
    }

    public boolean isDraft() {
        return STATUS_DRAFT.equals(status);
    }

    public void saveAsDraft() {
        this.status = STATUS_DRAFT;
        this.completedAt = null;
    }

    public void updateDraft(
        String title,
        String content,
        String templateCode,
        Integer templateVersion,
        String templateSnapshotJson,
        String formDataJson,
        String searchText
    ) {
        this.title = title;
        this.content = content;
        this.templateCode = templateCode;
        this.templateVersion = templateVersion;
        this.templateSnapshotJson = templateSnapshotJson;
        this.formDataJson = formDataJson;
        this.searchText = searchText;
        this.completedAt = null;
    }

    public void submit(String searchText) {
        this.status = STATUS_PENDING;
        this.searchText = searchText;
        this.requestedAt = LocalDateTime.now();
        this.completedAt = null;
    }

    public void approve() {
        this.status = STATUS_APPROVED;
        this.completedAt = LocalDateTime.now();
    }

    public void reject() {
        this.status = STATUS_REJECTED;
        this.completedAt = LocalDateTime.now();
    }

    public void withdraw() {
        this.status = STATUS_WITHDRAWN;
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
