package com.example.fx.simulator.web;

import java.io.IOException;
import java.util.concurrent.TimeUnit;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;

/** Retain a bounded copy of parsed input so errors can echo available request identification. */
@Component
public class SimulatorRequestContextFilter extends OncePerRequestFilter {
    private static final Logger LOG = LoggerFactory.getLogger(SimulatorRequestContextFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long startedAt = System.nanoTime();
        String requestId = request.getHeader("X-Request-Id");
        LOG.debug("HTTP request started method={} path={} requestId={}",
                request.getMethod(), request.getRequestURI(), requestId);
        try {
            chain.doFilter(new ContentCachingRequestWrapper(request, 16384), response);
        } finally {
            long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
            LOG.debug("HTTP request completed method={} path={} status={} durationMs={} requestId={}",
                    request.getMethod(), request.getRequestURI(), response.getStatus(), durationMs, requestId);
        }
    }
}
