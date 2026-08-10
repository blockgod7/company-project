package com.kjh.groupware.domain.emp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "emp_permission", uniqueConstraints = @UniqueConstraint(columnNames = {"emp_id", "permission_code"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmpPermission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "emp_permission_id")
    private Long empPermissionId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @Column(name = "permission_code", nullable = false, length = 40)
    private String permissionCode;

    @Column(name = "active_yn", nullable = false, length = 1)
    private String activeYn;

    @Column(name = "granted_at", nullable = false)
    private LocalDateTime grantedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "granted_by")
    private Emp grantedBy;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "revoked_by")
    private Emp revokedBy;

    @Column(name = "reason", length = 500)
    private String reason;

    public EmpPermission(Emp emp, String permissionCode, Emp grantedBy, String reason) {
        this.emp = emp;
        this.permissionCode = permissionCode;
        grant(grantedBy, reason);
    }

    public void grant(Emp actor, String reason) {
        this.activeYn = "Y";
        this.grantedAt = LocalDateTime.now();
        this.grantedBy = actor;
        this.revokedAt = null;
        this.revokedBy = null;
        this.reason = reason;
    }

    public void revoke(Emp actor, String reason) {
        this.activeYn = "N";
        this.revokedAt = LocalDateTime.now();
        this.revokedBy = actor;
        this.reason = reason;
    }
}
