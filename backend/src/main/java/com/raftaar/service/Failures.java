package com.raftaar.service;

import com.raftaar.integration.NamedRequests;
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

    /**
     * What went wrong, in a line: network failures named plainly ("Can't connect to https://host"), an HTTP error by
     * its status, otherwise the message of what actually failed. A request that broke off (a reset stream, a dropped
     * connection) is named too ("GET https://host/path: ..."), so it can be matched against the other side's logs.
     */
    public static String reason(Throwable e) {
        String request = null, where = null, failure = null, innermost = null;
        for (Throwable t = e; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t instanceof RestClientResponseException r)
                return "HTTP " + r.getStatusCode().value() + (r.getStatusText().isBlank() ? "" : " " + r.getStatusText());
            if (t instanceof NamedRequests.Failed f && request == null) {
                request = f.request();
                where = origin(request);
                failure = messages(f.getCause());
            }
            if (t instanceof UnknownHostException) return "Unknown host " + (t.getMessage() == null ? where : t.getMessage());
            if (t instanceof ConnectException || t instanceof ClosedChannelException) return "Can't connect" + (where == null ? "" : " to " + where);
            if (t instanceof HttpTimeoutException || t instanceof SocketTimeoutException) return "Timed out" + (where == null ? "" : " waiting for " + where);
            if (!(t instanceof NamedRequests.Failed) && t.getMessage() != null && !t.getMessage().isBlank()) innermost = t.getMessage();
        }
        String what = failure != null && !failure.isBlank() ? failure : innermost != null ? innermost : e.getClass().getSimpleName();
        return request != null ? request + ": " + what : what;
    }

    /**
     * The distinct messages down a cause chain, outermost first: "closed: fixed content-length: 500, bytes received:
     * 9", since the outer one alone ("closed") often doesn't say what happened.
     */
    private static String messages(Throwable e) {
        var out = new StringBuilder();
        for (Throwable t = e; t != null && out.length() < 300; t = t.getCause() == t ? null : t.getCause()) {
            String m = t.getMessage();
            if (m == null || m.isBlank() || out.indexOf(m) >= 0) continue;
            if (!out.isEmpty()) out.append(": ");
            out.append(m);
        }
        return out.isEmpty() ? null : out.toString();
    }

    /** "https://host:port" of "GET https://host:port/path". */
    private static String origin(String request) {
        Matcher m = ORIGIN.matcher(request);
        return m.find() ? m.group(1) : null;
    }

    private static final Pattern ORIGIN = Pattern.compile("(https?://[^/?#\\s]+)");

    /** Logs {@code what} failed: a warning with the reason when expected, otherwise an error with the stack trace. */
    public static void log(Logger log, String what, Throwable e) {
        if (expected(e)) {
            log.warn("{} failed: {}", what, reason(e));
            log.debug("{} failed", what, e); // the whole chain, with LOG_LEVEL=DEBUG
        } else {
            log.error("{} failed unexpectedly", what, e);
        }
    }
}
