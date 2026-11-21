package com.raftaar.common.http;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * Keeps us polite to one outside service:
 * <ul>
 *   <li>one request at a time, at least {@code gap} between the end of one and the start of the next;</li>
 *   <li>a bounded wait, so callers give up instead of queueing behind a backlog;</li>
 *   <li>exponential backoff: a request that fails because the service is busy or unreachable (429, 5xx, timeout)
 *       is retried after 1, 2, 4… seconds with jitter, at least as long as its Retry-After asks;</li>
 *   <li>and when the retries run out, the service is paused: calls fail straight away, without sending anything,
 *       for 30 s, then 1, 2, 4… minutes after each further failure (up to an hour), until a request works again.</li>
 * </ul>
 * The public OpenStreetMap services ask for this (Nominatim: at most one request a second).
 */
public class RequestLimiter {
    private static final Logger log = LoggerFactory.getLogger(RequestLimiter.class);

    /** The service couldn't be asked in time, or is paused; the caller should treat it as "no answer this time". */
    public static class Busy extends RuntimeException {
        public Busy(String message) {
            super(message);
        }
    }

    /**
     * @param retries     extra attempts for one call after a busy/unreachable failure
     * @param firstRetry  wait before the first retry; doubles for each one after
     * @param maxRetry    longest wait between two attempts
     * @param firstPause  how long the service is paused after a call's retries run out; doubles each time after
     * @param maxPause    longest pause
     */
    public record Backoff(int retries, Duration firstRetry, Duration maxRetry, Duration firstPause, Duration maxPause) {
        public static final Backoff DEFAULT = new Backoff(3, Duration.ofSeconds(1), Duration.ofSeconds(30), Duration.ofSeconds(30), Duration.ofHours(1));
    }

    private final String name;
    private final long gapNanos;
    private final long maxWaitNanos;
    private final Backoff backoff;
    private final Semaphore turn = new Semaphore(1, true); // fair: first come, first served
    // guarded by turn:
    private long nextStart = System.nanoTime();
    private long pausedUntil = System.nanoTime();
    private Instant pausedUntilClock;
    private int failedCalls;

    public RequestLimiter(String name, Duration gap, Duration maxWait) {
        this(name, gap, maxWait, Backoff.DEFAULT);
    }

    public RequestLimiter(String name, Duration gap, Duration maxWait, Backoff backoff) {
        this.name = name;
        this.gapNanos = gap.toNanos();
        this.maxWaitNanos = maxWait.toNanos();
        this.backoff = backoff;
    }

    public String name() {
        return name;
    }

    /**
     * Runs {@code request} when it's our turn, retrying with backoff while the service is busy. Throws
     * {@link Busy} if the turn doesn't come within the wait limit or the service is paused, and otherwise the
     * request's own exception once retrying stops.
     */
    public <T> T call(Supplier<T> request) {
        long deadline = System.nanoTime() + maxWaitNanos;
        acquire(deadline);
        try {
            if (System.nanoTime() < pausedUntil)
                throw new Busy(name + " is paused after repeated failures; trying again after " + pausedUntilClock);
            for (int attempt = 0; ; attempt++) {
                sleepUntil(nextStart, deadline);
                try {
                    T result = request.get();
                    nextStart = System.nanoTime() + gapNanos; // the gap counts from the end of a real request
                    if (failedCalls > 0) log.info("{} is answering again", name);
                    failedCalls = 0;
                    return result;
                } catch (RuntimeException e) {
                    nextStart = System.nanoTime() + gapNanos;
                    if (!retryable(e)) throw e;
                    long retryAfter = retryAfterNanos(e);
                    long wait = Math.max(retryDelayNanos(attempt), retryAfter);
                    if (attempt >= backoff.retries() || System.nanoTime() + wait > deadline) {
                        pause(retryAfter, e);
                        throw e;
                    }
                    log.debug("{} busy ({}); retry {} of {} in {} ms", name, describe(e), attempt + 1, backoff.retries(), wait / 1_000_000);
                    nextStart = Math.max(nextStart, System.nanoTime() + wait);
                }
            }
        } finally {
            turn.release();
        }
    }

    /** Busy or unreachable, worth asking again later: 429, 5xx, timeouts and connection failures. */
    static boolean retryable(RuntimeException e) {
        if (e instanceof RestClientResponseException r) {
            HttpStatusCode s = r.getStatusCode();
            return s.value() == 429 || s.is5xxServerError();
        }
        return e instanceof ResourceAccessException;
    }

    /** 1, 2, 4… times the first retry delay (capped), with jitter between half and all of it. */
    long retryDelayNanos(int attempt) {
        long base = backoff.firstRetry().toNanos() << Math.min(attempt, 20);
        long capped = Math.min(base, backoff.maxRetry().toNanos());
        return capped / 2 + ThreadLocalRandom.current().nextLong(capped / 2 + 1);
    }

    /** Pauses the service after a call's retries ran out: 30 s, then doubling, or longer if Retry-After says so. */
    private void pause(long retryAfter, RuntimeException e) {
        failedCalls++;
        long pause = Math.min(backoff.firstPause().toNanos() << Math.min(failedCalls - 1, 20), backoff.maxPause().toNanos());
        pause = Math.max(pause, retryAfter);
        pausedUntil = System.nanoTime() + pause;
        pausedUntilClock = Instant.now().plusNanos(pause).truncatedTo(java.time.temporal.ChronoUnit.SECONDS);
        log.warn("{} failed {} time(s) in a row ({}); not asking it again until {}", name, failedCalls, describe(e), pausedUntilClock);
    }

    /** Retry-After in seconds or as an HTTP date; 0 when absent or unreadable. Capped at the longest pause. */
    long retryAfterNanos(RuntimeException e) {
        if (!(e instanceof RestClientResponseException r) || r.getResponseHeaders() == null) return 0;
        String v = r.getResponseHeaders().getFirst("Retry-After");
        if (v == null || v.isBlank()) return 0;
        long nanos;
        try {
            nanos = TimeUnit.SECONDS.toNanos(Long.parseLong(v.trim()));
        } catch (NumberFormatException notSeconds) {
            try {
                var at = ZonedDateTime.parse(v.trim(), DateTimeFormatter.RFC_1123_DATE_TIME).toInstant();
                nanos = Duration.between(Instant.now(), at).toNanos();
            } catch (RuntimeException unreadable) {
                return 0;
            }
        }
        return Math.clamp(nanos, 0, backoff.maxPause().toNanos());
    }

    private static String describe(RuntimeException e) {
        return e instanceof RestClientResponseException r ? "HTTP " + r.getStatusCode().value() : e.getClass().getSimpleName();
    }

    private void acquire(long deadline) {
        try {
            if (!turn.tryAcquire(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS))
                throw new Busy(name + " is busy with other lookups; try again shortly");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new Busy("Interrupted while waiting for " + name);
        }
    }

    /** Sleeps until {@code until}, or throws {@link Busy} if that's past the deadline. */
    void sleepUntil(long until, long deadline) {
        long wait = until - System.nanoTime();
        if (wait <= 0) return;
        if (until > deadline) throw new Busy(name + " is busy with other lookups; try again shortly");
        try {
            TimeUnit.NANOSECONDS.sleep(wait);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new Busy("Interrupted while waiting for " + name);
        }
    }
}
