package com.kjh.groupware.domain.auth;

import com.kjh.groupware.global.exception.BusinessException;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class LoginRateLimiter {

    private final Map<String, AttemptWindow> attempts = new ConcurrentHashMap<>();
    private final Clock clock;
    private final int maxAttempts;
    private final long windowSeconds;

    public LoginRateLimiter(
        @Value("${app.security.login-rate-limit.max-attempts:10}") int maxAttempts,
        @Value("${app.security.login-rate-limit.window-seconds:300}") long windowSeconds
    ) {
        this.clock = Clock.systemUTC();
        this.maxAttempts = maxAttempts;
        this.windowSeconds = windowSeconds;
    }

    public void assertAllowed(String loginId, String ipAddress) {
        String key = key(loginId, ipAddress);
        AttemptWindow window = attempts.get(key);
        Instant now = Instant.now(clock);
        if (window == null || now.isAfter(window.startedAt().plusSeconds(windowSeconds))) {
            attempts.remove(key);
            return;
        }
        if (window.count() >= maxAttempts) {
            throw BusinessException.unauthorized("LOGIN_RATE_LIMITED", "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        }
    }

    public void recordFailure(String loginId, String ipAddress) {
        String key = key(loginId, ipAddress);
        Instant now = Instant.now(clock);
        attempts.compute(key, (ignored, window) -> {
            if (window == null || now.isAfter(window.startedAt().plusSeconds(windowSeconds))) {
                return new AttemptWindow(now, 1);
            }
            return new AttemptWindow(window.startedAt(), window.count() + 1);
        });
    }

    public void clear(String loginId, String ipAddress) {
        attempts.remove(key(loginId, ipAddress));
    }

    private String key(String loginId, String ipAddress) {
        return safe(ipAddress).toLowerCase() + ":" + safe(loginId).toLowerCase();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private record AttemptWindow(Instant startedAt, int count) {
    }
}
