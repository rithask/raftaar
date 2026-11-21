package com.raftaar.common.http;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * How long each API call took: every one at DEBUG ("GET /api/garage 200 in 12 ms"), and a warning for one slow
 * enough to notice. The path only: the query can hold what was searched for.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestTimes extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(RequestTimes.class);
    private static final long SLOW_MS = 2000;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long started = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            long elapsedMs = (System.nanoTime() - started) / 1_000_000;
            if (elapsedMs >= SLOW_MS) {
                log.warn("{} {} took {} ms ({})", request.getMethod(), request.getRequestURI(), elapsedMs, response.getStatus());
            } else if (log.isDebugEnabled()) {
                log.debug("{} {} {} in {} ms", request.getMethod(), request.getRequestURI(), response.getStatus(), elapsedMs);
            }
        }
    }
}
