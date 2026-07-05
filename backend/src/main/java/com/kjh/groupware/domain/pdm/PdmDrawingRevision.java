package com.kjh.groupware.domain.pdm;

import com.kjh.groupware.domain.emp.Emp;
import com.kjh.groupware.domain.file.AttachFile;
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
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "pdm_drawing_revision")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PdmDrawingRevision extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "revision_id")
    private Long revisionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "drawing_id", nullable = false)
    private PdmDrawing drawing;

    @Column(name = "revision_label", nullable = false, length = 50)
    private String revisionLabel;

    @Column(name = "revision_order", nullable = false)
    private Integer revisionOrder;

    @Column(name = "revision_date")
    private LocalDate revisionDate;

    @Column(name = "received_date")
    private LocalDate receivedDate;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "file_id")
    private AttachFile file;

    @Column(name = "latest_yn", nullable = false, length = 1)
    private String latestYn;

    @Column(name = "void_yn", nullable = false, length = 1)
    private String voidYn;

    @Column(name = "change_note", columnDefinition = "text")
    private String changeNote;

    @Column(name = "created_by_emp_id", nullable = false)
    private Long createdByEmpId;

    @Builder
    private PdmDrawingRevision(
        PdmDrawing drawing,
        String revisionLabel,
        Integer revisionOrder,
        LocalDate revisionDate,
        LocalDate receivedDate,
        String changeNote,
        Emp createdBy
    ) {
        this.drawing = drawing;
        this.revisionLabel = revisionLabel;
        this.revisionOrder = revisionOrder;
        this.revisionDate = revisionDate;
        this.receivedDate = receivedDate;
        this.changeNote = changeNote;
        this.latestYn = "N";
        this.voidYn = "N";
        this.createdByEmpId = createdBy == null ? null : createdBy.getEmpId();
    }

    public void attachFile(AttachFile file) {
        if (this.file != null) {
            throw new IllegalStateException("Registered revision file cannot be overwritten");
        }
        this.file = file;
    }

    public void markLatest(boolean latest) {
        this.latestYn = latest ? "Y" : "N";
    }

    public void voidRevision() {
        this.voidYn = "Y";
        this.latestYn = "N";
    }
}
