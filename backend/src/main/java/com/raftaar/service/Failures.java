package com.raftaar.service;

import com.raftaar.integration.RequestLimiter;
import org.slf4j.Logger;
import org.springframework.web.client.RestClientException;

import org.springframework.web.client.RestClientResponseException;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.net.http.HttpTimeoutException;
import java.nio.channels.ClosedChannelException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * How to log a failure. Expected ones (an outside service down, slow or refusing, or something not set up) are a
 * warning with a one-line reason: there's nothing to fix in the code. Anything else is a bug, logged as an error
 * with its stack trace so it can be found.
 */
public final class Failures {
    private Failures() {}

    /** An outside service failing, or one of our own "can't do that" messages, rather than a bug. */
    public static boolean expected(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t instanceof RestClientException || t instanceof IOException || t instanceof UncheckedIOException
                    || t instanceof RequestLimiter.Busy || t instanceof HttpTimeoutException) return true;
        }
        // our own messages for things that aren't set up or can't be done right now
        return e instanceof IllegalStateException && e.getCause() == null || e instanceof IllegalArgumentException;
    }

    private static final Pattern REQUEST_URL = Pattern.compile("request for \"(https?://[^/\"?]+)");

    /**
     * What went wrong, in a line: network failures named plainly ("Can't connect to http://host"), an HTTP error by
     * its status, otherwise the innermost message, which is usually the one that says what actually happened.
     */
    public static String reason(Throwable e) {
        String where = null;
        Matcher m = REQUEST_URL.matcher(String.valueOf(e.getMessage()));
        if (m.find()) where = m.group(1);
        String innermost = null;
        for (Throwable t = e; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t instanceof RestClientResponseException r)
                return "HTTP " + r.getStatusCode().value() + (r.getStatusText().isBlank() ? "" : " " + r.getStatusText());
            if (t instanceof UnknownHostException) return "Unknown host " + (t.getMessage() == null ? where : t.getMessage());
            if (t instanceof ConnectException || t instanceof ClosedChannelException) return "Can't connect" + (where == null ? "" : " to " + where);
            if (t instanceof HttpTimeoutException || t instanceof SocketTimeoutException) return "Timed out" + (where == null ? "" : " waiting for " + where);
            if (t.getMessage() != null && !t.getMessage().isBlank()) innermost = t.getMessage();
        }
        return innermost != null ? innermost : e.getClass().getSimpleName();
    }

    /** Logs {@code what} failed: a warning with the reason when expected, otherwise an error with the stack trace. */
    public static void log(Logger log, String what, Throwable e) {
        if (expected(e)) log.warn("{} failed: {}", what, reason(e));
        else log.error("{} failed unexpectedly", what, e);
    }
}
