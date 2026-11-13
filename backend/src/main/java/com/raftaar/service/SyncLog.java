package com.raftaar.service;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/** When each integration last ran, what it did, and its last error. Also keeps two runs of one from overlapping. */
@Service
public class SyncLog {
    private final Settings settings;
    private final ConcurrentHashMap<String, ReentrantLock> locks = new ConcurrentHashMap<>();

    public SyncLog(Settings settings) {
        this.settings = settings;
    }

    public record Status(Instant lastRun, String lastResult, String lastError, Instant lastErrorAt, boolean running) {}

    public interface Job {
        String run() throws Exception;
    }

    /** Runs {@code job} unless it's already running; returns what it did. */
    public String run(String name, Job job) {
        ReentrantLock lock = locks.computeIfAbsent(name, k -> new ReentrantLock());
        if (!lock.tryLock()) return "Already running";
        try {
            String result = job.run();
            settings.set(name + ".lastRun", Instant.now());
            settings.set(name + ".lastResult", result);
            settings.set(name + ".lastError", null);
            return result;
        } catch (Exception e) {
            String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            if (msg.length() > 500) msg = msg.substring(0, 500);
            settings.set(name + ".lastRun", Instant.now());
            settings.set(name + ".lastError", msg);
            settings.set(name + ".lastErrorAt", Instant.now());
            throw new IllegalStateException(msg, e);
        } finally {
            lock.unlock();
        }
    }

    public Status status(String name) {
        var lock = locks.get(name);
        return new Status(settings.instant(name + ".lastRun").orElse(null), settings.get(name + ".lastResult").orElse(null),
                settings.get(name + ".lastError").orElse(null), settings.instant(name + ".lastErrorAt").orElse(null),
                lock != null && lock.isLocked());
    }
}
