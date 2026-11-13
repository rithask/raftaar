package com.raftaar.integration;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class RequestLimiterTest {

    @Test
    void oneRequestAtATimeWithAGapBetween() throws Exception {
        var limiter = new RequestLimiter("test", Duration.ofMillis(100), Duration.ofSeconds(10));
        var inFlight = new AtomicInteger();
        var most = new AtomicInteger();
        List<Long> starts = Collections.synchronizedList(new ArrayList<>());
        List<Long> ends = Collections.synchronizedList(new ArrayList<>());
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<?>> all = new ArrayList<>();
            for (int i = 0; i < 6; i++) {
                all.add(pool.submit(() -> limiter.call(() -> {
                    most.accumulateAndGet(inFlight.incrementAndGet(), Math::max);
                    starts.add(System.nanoTime());
                    sleep(20);
                    ends.add(System.nanoTime());
                    inFlight.decrementAndGet();
                    return null;
                })));
            }
            for (var f : all) f.get();
        }
        assertEquals(1, most.get(), "never more than one request at a time");
        Collections.sort(starts);
        Collections.sort(ends);
        for (int i = 1; i < starts.size(); i++) {
            long gapMs = (starts.get(i) - ends.get(i - 1)) / 1_000_000;
            assertTrue(gapMs >= 95, "gap between requests was " + gapMs + " ms");
        }
    }

    @Test
    void givesUpInsteadOfQueueingForever() throws Exception {
        var limiter = new RequestLimiter("test", Duration.ZERO, Duration.ofMillis(100));
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var slow = pool.submit(() -> limiter.call(() -> {
                sleep(500);
                return "slow";
            }));
            sleep(50);
            long t = System.nanoTime();
            assertThrows(RequestLimiter.Busy.class, () -> limiter.call(() -> "never"));
            long waitedMs = (System.nanoTime() - t) / 1_000_000;
            assertTrue(waitedMs < 300, "waited " + waitedMs + " ms");
            assertEquals("slow", slow.get());
        }
        assertEquals("next", limiter.call(() -> "next"), "free again afterwards");
    }

    @Test
    void aFailedRequestStillFreesTheTurn() {
        var limiter = new RequestLimiter("test", Duration.ZERO, Duration.ofMillis(100));
        assertThrows(IllegalStateException.class, () -> limiter.call(() -> {
            throw new IllegalStateException("boom");
        }));
        assertEquals("ok", limiter.call(() -> "ok"));
    }

    // ---- backoff ---------------------------------------------------------------------------------------------

    /** Quick timings: retries after 20, 40, 80 ms; pauses of 300 ms, then 600 ms… */
    static final RequestLimiter.Backoff QUICK = new RequestLimiter.Backoff(3, Duration.ofMillis(20), Duration.ofMillis(200), Duration.ofMillis(300), Duration.ofSeconds(2));

    static RuntimeException tooMany(String retryAfter) {
        var h = new HttpHeaders();
        if (retryAfter != null) h.add("Retry-After", retryAfter);
        return HttpClientErrorException.create(HttpStatus.TOO_MANY_REQUESTS, "busy", h, new byte[0], null);
    }

    @Test
    void retriesABusyServiceWithGrowingWaits() {
        var limiter = new RequestLimiter("test", Duration.ZERO, Duration.ofSeconds(5), QUICK);
        List<Long> at = new ArrayList<>();
        String r = limiter.call(() -> {
            at.add(System.nanoTime());
            if (at.size() < 4) throw at.size() == 2 ? HttpServerErrorException.create(HttpStatus.GATEWAY_TIMEOUT, "slow", new HttpHeaders(), new byte[0], null) : tooMany(null);
            return "ok";
        });
        assertEquals("ok", r);
        assertEquals(4, at.size(), "three retries");
        // waits are between half and all of 20, 40, 80 ms
        long[] lo = {10, 20, 40}, hi = {60, 90, 150};
        for (int i = 1; i < at.size(); i++) {
            long ms = (at.get(i) - at.get(i - 1)) / 1_000_000;
            assertTrue(ms >= lo[i - 1] && ms <= hi[i - 1], "wait " + i + " was " + ms + " ms");
        }
    }

    @Test
    void waitsAtLeastAsLongAsRetryAfterAsks() {
        var limiter = new RequestLimiter("test", Duration.ZERO, Duration.ofSeconds(5), QUICK);
        List<Long> at = new ArrayList<>();
        limiter.call(() -> {
            at.add(System.nanoTime());
            if (at.size() == 1) throw tooMany("1");
            return "ok";
        });
        long ms = (at.get(1) - at.get(0)) / 1_000_000;
        assertTrue(ms >= 990, "waited " + ms + " ms for Retry-After: 1");
    }

    @Test
    void doesNotRetryOtherErrors() {
        var limiter = new RequestLimiter("test", Duration.ZERO, Duration.ofSeconds(5), QUICK);
        var calls = new AtomicInteger();
        assertThrows(HttpClientErrorException.class, () -> limiter.call(() -> {
            calls.incrementAndGet();
            throw HttpClientErrorException.create(HttpStatus.BAD_REQUEST, "bad", new HttpHeaders(), new byte[0], null);
        }));
        assertEquals(1, calls.get());
        assertEquals("ok", limiter.call(() -> "ok"), "a 400 doesn't pause the service");
    }

    @Test
    void pausesAfterRetriesRunOutAndSendsNothingMeanwhile() {
        var limiter = new RequestLimiter("test", Duration.ZERO, Duration.ofSeconds(5), QUICK);
        var calls = new AtomicInteger();
        assertThrows(ResourceAccessException.class, () -> limiter.call(() -> {
            calls.incrementAndGet();
            throw new ResourceAccessException("connection refused");
        }));
        assertEquals(4, calls.get(), "first try plus three retries");

        long t = System.nanoTime();
        var paused = assertThrows(RequestLimiter.Busy.class, () -> limiter.call(() -> {
            calls.incrementAndGet();
            return "sent";
        }));
        assertTrue(paused.getMessage().contains("paused"), paused.getMessage());
        assertEquals(4, calls.get(), "nothing sent while paused");
        assertTrue((System.nanoTime() - t) / 1_000_000 < 50, "fails straight away while paused");

        sleep(320);
        assertEquals("sent", limiter.call(() -> "sent"), "asks again once the pause is over");
    }

    @Test
    void pausesGrowAfterEachFailureAndResetAfterSuccess() {
        var limiter = new RequestLimiter("test", Duration.ZERO, Duration.ofSeconds(5),
                new RequestLimiter.Backoff(0, Duration.ofMillis(10), Duration.ofMillis(10), Duration.ofMillis(100), Duration.ofSeconds(2)));
        assertThrows(HttpClientErrorException.class, () -> limiter.call(() -> { throw tooMany(null); }));
        sleep(120); // first pause: 100 ms
        assertThrows(HttpClientErrorException.class, () -> limiter.call(() -> { throw tooMany(null); }));
        sleep(120); // second pause is 200 ms, so still paused
        assertThrows(RequestLimiter.Busy.class, () -> limiter.call(() -> "x"));
        sleep(100);
        assertEquals("ok", limiter.call(() -> "ok"));
        assertThrows(HttpClientErrorException.class, () -> limiter.call(() -> { throw tooMany(null); }));
        sleep(120); // after a success it starts again from 100 ms
        assertEquals("ok", limiter.call(() -> "ok"));
    }

    @Test
    void aRetryAfterLongerThanTheWaitLimitPausesInsteadOfWaiting() {
        var limiter = new RequestLimiter("test", Duration.ZERO, Duration.ofMillis(500), QUICK);
        long t = System.nanoTime();
        assertThrows(HttpClientErrorException.class, () -> limiter.call(() -> { throw tooMany("60"); }));
        assertTrue((System.nanoTime() - t) / 1_000_000 < 100, "didn't sit out the minute");
        assertThrows(RequestLimiter.Busy.class, () -> limiter.call(() -> "x"), "paused for what Retry-After asked");
    }

    static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }
}
