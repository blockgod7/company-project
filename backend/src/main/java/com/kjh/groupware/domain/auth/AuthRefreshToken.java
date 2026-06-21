package com.kjh.groupware.domain.auth;

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
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "auth_refresh_token")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AuthRefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "refresh_token_id")
    private Long refreshTokenId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "emp_id", nullable = false)
    private Emp emp;

    @Column(name = "token_hash", nullable = false, unique = true, length = 128)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @Column(name = "created_ip", length = 100)
    private String createdIp;

    @Column(name = "created_user_agent", length = 500)
    private String createdUserAgent;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public AuthRefreshToken(
        Emp emp,
        String tokenHash,
        LocalDateTime expiresAt,
        String createdIp,
        String createdUserAgent
    ) {
        this.emp = emp;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
        this.createdIp = createdIp;
        this.createdUserAgent = truncate(createdUserAgent, 500);
        this.createdAt = LocalDateTime.now();
    }

    public boolean isUsable(LocalDateTime now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public void revoke() {
        if (revokedAt == null) {
            revokedAt = LocalDateTime.now();
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
