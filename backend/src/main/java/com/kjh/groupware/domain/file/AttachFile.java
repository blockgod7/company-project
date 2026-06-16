package com.kjh.groupware.domain.file;

import com.kjh.groupware.domain.emp.Emp;
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
import org.hibernate.annotations.CreationTimestamp;

@Entity
@Table(name = "attach_file")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AttachFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "file_id")
    private Long fileId;

    @Column(name = "target_type", nullable = false, length = 50)
    private String targetType;

    @Column(name = "target_id", nullable = false)
    private Long targetId;

    @Column(name = "original_file_name", nullable = false)
    private String originalFileName;

    @Column(name = "stored_file_name", nullable = false)
    private String storedFileName;

    @Column(name = "storage_path", nullable = false, length = 500)
    private String storagePath;

    @Column(name = "file_size", nullable = false)
    private Long fileSize;

    @Column(name = "file_ext", length = 30)
    private String fileExt;

    @Column(name = "file_hash", length = 128)
    private String fileHash;

    @Column(name = "mime_type", length = 100)
    private String mimeType;

    @Column(name = "deleted_yn", nullable = false, length = 1)
    private String deletedYn;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "deleted_by")
    private Emp deletedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private Emp createdBy;

    @Builder
    private AttachFile(
        String targetType,
        Long targetId,
        String originalFileName,
        String storedFileName,
        String storagePath,
        Long fileSize,
        String fileExt,
        String fileHash,
        String mimeType,
        Emp createdBy
    ) {
        this.targetType = targetType;
        this.targetId = targetId;
        this.originalFileName = originalFileName;
        this.storedFileName = storedFileName;
        this.storagePath = storagePath;
        this.fileSize = fileSize;
        this.fileExt = fileExt;
        this.fileHash = fileHash;
        this.mimeType = mimeType;
        this.createdBy = createdBy;
        this.deletedYn = "N";
    }

    public void delete(Emp deletedBy) {
        this.deletedYn = "Y";
        this.deletedAt = LocalDateTime.now();
        this.deletedBy = deletedBy;
    }
}
