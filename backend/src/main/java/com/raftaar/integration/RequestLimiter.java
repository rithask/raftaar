package com.raftaar.integration;

import java.time.Duration;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * Keeps us polite to one outside service: one request at a time, at least {@code gap} between the end of one and
 * the start of the next, and a bounded wait so callers give up instead of queueing behind a backlog. The public
 * OpenStreetMap services ask for this (Nominatim: at most one request a second).
 */
public class RequestLimiter {
    /** The service couldn't be asked in time; the caller should treat it as "no answer this time". */
    public static class Busy extends RuntimeException {
        public Busy(String message) {
            super(message);
        }
    }

    private final String name;
    private final long gapNanos;
    private final long maxWaitNanos;
    private final Semaphore turn = new Semaphore(1, true); // fair: first come, first served
    private long nextStart = System.nanoTime();             // guarded by turn

    public RequestLimiter(String name, Duration gap, Duration maxWait) {
        this.name = name;
        this.gapNanos = gap.toNanos();
        this.maxWaitNanos = maxWait.toNanos();
    }

    public String name() {
        return name;
    }

    /** Runs {@code request} when it's our turn; throws {@link Busy} if that doesn't come within the wait limit. */
    public <T> T call(Supplier<T> request) {
        long deadline = System.nanoTime() + maxWaitNanos;
        acquire(deadline);
        boolean sent = false;
        try {
            sleepUntil(nextStart, deadline);
            sent = true;
            return request.get();
        } finally {
            if (sent) nextStart = System.nanoTime() + gapNanos; // the gap counts from the end of a real request
            turn.release();
        }
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
