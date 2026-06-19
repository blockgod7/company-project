package com.kjh.groupware.domain.emp;

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
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "emp_signature")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmpSignature extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "signature_id")
    private Long signatureId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "signature_file_id")
    private AttachFile signatureFile;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(name = "active_yn", nullable = false, length = 1)
    private String activeYn;

    @Builder
    private EmpSignature(Emp emp, AttachFile signatureFile, String displayName, String activeYn) {
        this.emp = emp;
        this.signatureFile = signatureFile;
        this.displayName = displayName;
        this.activeYn = activeYn == null ? "Y" : activeYn;
    }

    public void deactivate() {
        this.activeYn = "N";
    }
}
