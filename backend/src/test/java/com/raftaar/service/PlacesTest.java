package com.raftaar.service;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

class PlacesTest {
    /** Only the in-flight sharing is under test, so no repositories or client are needed. */
    private final Places places = new Places(null, null, null, null);

    @Test
    void concurrentLookupsOfTheSameSquareShareOneRequest() throws Exception {
        var calls = new AtomicInteger();
        var started = new CountDownLatch(1);
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<String>> all = new ArrayList<>();
            all.add(pool.submit(() -> places.once("cell:1", () -> {
                calls.incrementAndGet();
                started.countDown();
                sleep(200);
                return "Kerala";
            })));
            started.await();
            for (int i = 0; i < 5; i++) {
                all.add(pool.submit(() -> places.once("cell:1", () -> {
                    calls.incrementAndGet();
                    return "asked again";
                })));
            }
            for (var f : all) assertEquals("Kerala", f.get());
        }
        assertEquals(1, calls.get(), "one request for six callers");
    }

    @Test
    void differentSquaresAreLookedUpSeparately() {
        assertEquals("a", places.once("cell:1", () -> "a"));
        assertEquals("b", places.once("cell:2", () -> "b"));
    }

    @Test
    void aFailureIsSharedAndTheNextCallTriesAgain() throws Exception {
        var started = new CountDownLatch(1);
        try (var pool = Executors.newVirtualThreadPerTaskExecutor()) {
            var first = pool.submit(() -> places.once("cell:9", () -> {
                started.countDown();
                sleep(150);
                throw new IllegalStateException("down");
            }));
            started.await();
            var second = pool.submit(() -> places.once("cell:9", () -> "never"));
            assertInstanceOf(IllegalStateException.class, assertThrows(Exception.class, first::get).getCause());
            assertInstanceOf(IllegalStateException.class, assertThrows(Exception.class, second::get).getCause());
        }
        assertEquals("up", places.once("cell:9", () -> "up"), "not stuck after a failure");
    }

    static void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }
}
