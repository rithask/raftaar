package com.raftaar.integration;

import org.junit.jupiter.api.Test;

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

    static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }
}
