package com.kjh.groupware.global.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        jwtTokenProvider.resolveToken(request).ifPresent(token -> {
            if (jwtTokenProvider.validateToken(token)) {
                jwtTokenProvider.getAuthentication(token)
                    .ifPresent(authentication -> org.springframework.security.core.context.SecurityContextHolder
                        .getContext()
                        .setAuthentication(authentication));
            }
        });

        filterChain.doFilter(request, response);
    }
}
