package com.kjh.groupware.domain.pdm;

import com.kjh.groupware.domain.approval.ApprovalDocument;
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
@Table(name = "pdm_download_request")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PdmDownloadRequest extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "request_id")
    private Long requestId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "drawing_id", nullable = false)
    private PdmDrawing drawing;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "revision_id", nullable = false)
    private PdmDrawingRevision revision;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "requester_emp_id", nullable = false)
    private Emp requester;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "approval_id", nullable = false)
    private ApprovalDocument approval;

    @Column(name = "reason", nullable = false, columnDefinition = "text")
    private String reason;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Builder
    private PdmDownloadRequest(PdmDrawing drawing, PdmDrawingRevision revision, Emp requester, ApprovalDocument approval, String reason) {
        this.drawing = drawing;
        this.revision = revision;
        this.requester = requester;
        this.approval = approval;
        this.reason = reason;
    }

    public LocalDateTime approvedUntil() {
        if (approval == null || approval.getCompletedAt() == null) {
            return null;
        }
        return approval.getCompletedAt().plusHours(PdmConstants.DOWNLOAD_VALID_HOURS);
    }

    public void refreshExpiresAtFromApproval() {
        this.expiresAt = approvedUntil();
    }
}
