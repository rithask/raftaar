package com.raftaar.service;

import com.raftaar.integration.RequestLimiter;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.net.ConnectException;

import static org.junit.jupiter.api.Assertions.*;

class FailuresTest {

    @Test
    void outsideServicesFailingAreExpected() {
        assertTrue(Failures.expected(new ResourceAccessException("I/O error", new ConnectException("Connection refused"))));
        assertTrue(Failures.expected(HttpClientErrorException.create(HttpStatus.UNAUTHORIZED, "no", new HttpHeaders(), new byte[0], null)));
        assertTrue(Failures.expected(new RequestLimiter.Busy("paused")));
        assertTrue(Failures.expected(new IllegalStateException("wrapped", new ResourceAccessException("timeout"))), "found in the cause chain");
    }

    @Test
    void ourOwnMessagesAreExpected() {
        assertTrue(Failures.expected(new IllegalStateException("Hisaab isn't set up")));
        assertTrue(Failures.expected(new IllegalArgumentException("Bad file name")));
    }

    @Test
    void bugsAreNot() {
        assertFalse(Failures.expected(new NullPointerException()));
        assertFalse(Failures.expected(new DataIntegrityViolationException("null value in column")));
        assertFalse(Failures.expected(new IllegalStateException("wrapped", new NullPointerException())), "a wrapped bug is still a bug");
    }

    @Test
    void reasonNamesNetworkFailuresPlainly() {
        var refused = new ResourceAccessException("I/O error on GET request for \"http://hisaab.lan:8080/api/v1/transactions\": null",
                new ConnectException(null));
        assertEquals("Can't connect to http://hisaab.lan:8080", Failures.reason(refused));
        assertEquals("Can't connect to http://h:1", Failures.reason(new ResourceAccessException("I/O error on GET request for \"http://h:1/x\": null",
                connectFailedWith(new java.nio.channels.ClosedChannelException()))));
        assertEquals("Timed out waiting for https://overpass-api.de", Failures.reason(new ResourceAccessException(
                "I/O error on POST request for \"https://overpass-api.de/api/interpreter\": request timed out", new java.net.http.HttpTimeoutException("request timed out"))));
        assertEquals("HTTP 401 Unauthorized", Failures.reason(new IllegalStateException("wrapped",
                HttpClientErrorException.create(HttpStatus.UNAUTHORIZED, "Unauthorized", new HttpHeaders(), new byte[0], null))));
    }

    @Test
    void otherwiseTheInnermostMessage() {
        assertEquals("null value in column", Failures.reason(new IllegalStateException("outer", new DataIntegrityViolationException("null value in column"))));
        assertEquals("NullPointerException", Failures.reason(new NullPointerException()));
    }

    /** How the JDK's HTTP client reports a refused connection: a ConnectException with no message, caused by this. */
    static ConnectException connectFailedWith(Throwable cause) {
        var e = new ConnectException();
        e.initCause(cause);
        return e;
    }
}
