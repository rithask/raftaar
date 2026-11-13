package com.raftaar.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * When each integration last ran, what it did, and its last error. Also keeps two runs of one from overlapping, and
 * is the one place a run's failure is logged, whether it ran on schedule or from "Sync now".
 */
@Service
public class SyncLog {
    private static final Logger log = LoggerFactory.getLogger(SyncLog.class);
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
            Failures.log(log, title(name), e);
            String msg = Failures.reason(e);
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

    private static String title(String name) {
        return switch (name) {
            case "geopulse" -> "GeoPulse sync";
            case "hisaab" -> "Hisaab sync";
            case "alerts" -> "Daily reminders";
            default -> name;
        };
    }
}
