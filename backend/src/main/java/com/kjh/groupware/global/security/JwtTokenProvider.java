package com.kjh.groupware.global.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class JwtTokenProvider {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final String TOKEN_TYPE_ACCESS = "access";
    private static final String TOKEN_TYPE_REFRESH = "refresh";

    private final SecretKey secretKey;
    private final long accessTokenValiditySeconds;
    private final long refreshTokenValiditySeconds;

    public JwtTokenProvider(
        @Value("${app.jwt.secret}") String secret,
        @Value("${app.jwt.access-token-validity-seconds}") long accessTokenValiditySeconds,
        @Value("${app.jwt.refresh-token-validity-seconds}") long refreshTokenValiditySeconds
    ) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenValiditySeconds = accessTokenValiditySeconds;
        this.refreshTokenValiditySeconds = refreshTokenValiditySeconds;
    }

    public String createAccessToken(Long empId, String loginId, String roleCode) {
        return createToken(empId, loginId, roleCode, TOKEN_TYPE_ACCESS, accessTokenValiditySeconds);
    }

    public String createRefreshToken(Long empId, String loginId, String roleCode) {
        return createToken(empId, loginId, roleCode, TOKEN_TYPE_REFRESH, refreshTokenValiditySeconds);
    }

    private String createToken(Long empId, String loginId, String roleCode, String tokenType, long validitySeconds) {
        Instant now = Instant.now();
        return Jwts.builder()
            .id(UUID.randomUUID().toString())
            .subject(loginId)
            .claim("emp_id", empId)
            .claim("role_code", roleCode)
            .claim("token_type", tokenType)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(validitySeconds)))
            .signWith(secretKey)
            .compact();
    }

    public long getRefreshTokenValiditySeconds() {
        return refreshTokenValiditySeconds;
    }

    public Optional<String> resolveToken(HttpServletRequest request) {
        String authorization = request.getHeader("Authorization");
        if (!StringUtils.hasText(authorization) || !authorization.startsWith(BEARER_PREFIX)) {
            return Optional.empty();
        }
        return Optional.of(authorization.substring(BEARER_PREFIX.length()));
    }

    public boolean validateToken(String token) {
        try {
            Claims claims = parseClaims(token);
            if (!TOKEN_TYPE_ACCESS.equals(claims.get("token_type", String.class))) {
                return false;
            }
            return true;
        } catch (RuntimeException ex) {
            return false;
        }
    }

    public Optional<Claims> validateRefreshToken(String token) {
        try {
            Claims claims = parseClaims(token);
            if (!TOKEN_TYPE_REFRESH.equals(claims.get("token_type", String.class))) {
                return Optional.empty();
            }
            return Optional.of(claims);
        } catch (RuntimeException ex) {
            return Optional.empty();
        }
    }

    public Optional<Authentication> getAuthentication(String token) {
        Claims claims = parseClaims(token);
        String loginId = claims.getSubject();
        String roleCode = claims.get("role_code", String.class);
        if (!StringUtils.hasText(loginId)) {
            return Optional.empty();
        }

        List<SimpleGrantedAuthority> authorities = StringUtils.hasText(roleCode)
            ? List.of(new SimpleGrantedAuthority("ROLE_" + roleCode))
            : List.of();

        return Optional.of(new UsernamePasswordAuthenticationToken(loginId, token, authorities));
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
            .verifyWith(secretKey)
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
