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

    private final SecretKey secretKey;
    private final long accessTokenValiditySeconds;

    public JwtTokenProvider(
        @Value("${app.jwt.secret}") String secret,
        @Value("${app.jwt.access-token-validity-seconds}") long accessTokenValiditySeconds
    ) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessTokenValiditySeconds = accessTokenValiditySeconds;
    }

    public String createAccessToken(Long empId, String loginId, String roleCode) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(loginId)
            .claim("emp_id", empId)
            .claim("role_code", roleCode)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(accessTokenValiditySeconds)))
            .signWith(secretKey)
            .compact();
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
            parseClaims(token);
            return true;
        } catch (RuntimeException ex) {
            return false;
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
