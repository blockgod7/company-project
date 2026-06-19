package com.kjh.groupware.domain.approval;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.file.AttachFile;
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
@Table(name = "approval_pdf_history")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApprovalPdfHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "approval_id", nullable = false)
    private ApprovalDocument approval;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "old_pdf_file_id")
    private AttachFile oldPdfFile;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "new_pdf_file_id", nullable = false)
    private AttachFile newPdfFile;

    @Column(name = "old_pdf_hash", length = 128)
    private String oldPdfHash;

    @Column(name = "new_pdf_hash", nullable = false, length = 128)
    private String newPdfHash;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "regenerated_by", nullable = false)
    private Emp regeneratedBy;

    @Column(name = "regenerated_at", nullable = false)
    private LocalDateTime regeneratedAt;

    @Column(name = "reason", columnDefinition = "text")
    private String reason;

    @Builder
    private ApprovalPdfHistory(
        ApprovalDocument approval,
        AttachFile oldPdfFile,
        AttachFile newPdfFile,
        String oldPdfHash,
        String newPdfHash,
        Emp regeneratedBy,
        String reason
    ) {
        this.approval = approval;
        this.oldPdfFile = oldPdfFile;
        this.newPdfFile = newPdfFile;
        this.oldPdfHash = oldPdfHash;
        this.newPdfHash = newPdfHash;
        this.regeneratedBy = regeneratedBy;
        this.reason = reason;
        this.regeneratedAt = LocalDateTime.now();
    }
}
