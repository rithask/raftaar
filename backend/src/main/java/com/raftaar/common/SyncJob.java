package com.raftaar.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A job that runs on a schedule and on demand ("Sync now"): GeoPulse, Hisaab, the daily reminders. The steps are
 * the same for each (skip it on schedule when it isn't set up, say so on demand, run it through SyncLog so its
 * status is kept and two runs never overlap, log the result); a job only says what it is and does its work.
 * Each subclass keeps its own {@code @Scheduled} method, which calls {@link #runOnSchedule()}. (Not final: a final
 * method on a Spring proxy would run against the proxy's empty fields.)
 */
public abstract class SyncJob {
    private final Logger log = LoggerFactory.getLogger(getClass());
    private final SyncLog syncLog;

    protected SyncJob(SyncLog syncLog) {
        this.syncLog = syncLog;
    }

    /** The key its status is kept under, e.g. "hisaab". */
    public abstract String name();

    /** How it's named in logs and errors, e.g. "Hisaab sync". */
    protected abstract String title();

    protected abstract boolean configured();

    /** What to set up, for "run now" when it isn't configured. */
    protected abstract String notConfiguredMessage();

    /** The work itself; returns what it did, in a line ("2 fuel payments, 1 expense"). */
    protected abstract String work() throws Exception;

    /** Runs it now; what it did. Fails when it isn't set up, or with the reason it failed (already logged). */
    public String run() {
        if (!configured()) throw new IllegalStateException(notConfiguredMessage());
        return syncLog.run(name(), title(), this::work);
    }

    /** For the {@code @Scheduled} method: runs it when it's set up, and logs what it did. */
    protected void runOnSchedule() {
        if (!configured()) return;
        try {
            log.info("{}: {}", title(), run());
        } catch (RuntimeException alreadyLogged) {
            log.debug("{} failed", title(), alreadyLogged);
        }
    }
}
