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

    /** A client like the app's: Java's HTTP client (its default HTTP version), with failures named by NamedRequests. */
    static final org.springframework.web.client.RestClient CLIENT = client();

    static org.springframework.web.client.RestClient client() {
        var http = java.net.http.HttpClient.newBuilder().connectTimeout(java.time.Duration.ofSeconds(5)).build();
        var factory = new org.springframework.http.client.JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(java.time.Duration.ofSeconds(5)); // a test must never hang
        return org.springframework.web.client.RestClient.builder().requestFactory(factory)
                .requestInterceptor(new com.raftaar.integration.NamedRequests()).build();
    }

    /**
     * A server that, for every connection (Java's client retries a request whose connection dropped), reads the
     * request, sends {@code answer}, and hangs up.
     */
    static <T> T against(String answer, java.util.function.Function<String, T> call) throws Exception {
        try (var server = new java.net.ServerSocket(0, 10, java.net.InetAddress.getLoopbackAddress())) {
            var t = Thread.ofVirtual().start(() -> {
                while (!server.isClosed()) {
                    try (var c = server.accept()) {
                        c.getInputStream().read(new byte[8192]);
                        c.getOutputStream().write(answer.getBytes());
                        c.getOutputStream().flush();
                    } catch (java.io.IOException closed) {
                        return;
                    }
                }
            });
            try {
                return call.apply("http://127.0.0.1:" + server.getLocalPort());
            } finally {
                server.close();
                t.join(5000);
            }
        }
    }

    @Test
    void aResponseThatBreaksOffPartwayNamesTheRequest() throws Exception {
        String[] url = new String[1];
        var e = against("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 500\r\n\r\n{\"data\":[", base -> {
            url[0] = base + "/api/v1/transactions?limit=200";
            return assertThrows(RuntimeException.class, () -> CLIENT.get().uri(url[0]).retrieve().body(String.class));
        });
        String reason = Failures.reason(e);
        assertTrue(Failures.expected(e), e.toString());
        assertTrue(reason.startsWith("GET " + url[0] + ": "), reason);
        assertTrue(reason.contains("500"), "says what broke: " + reason);
    }

    @Test
    void aConnectionDroppedBeforeAnAnswerNamesTheRequest() throws Exception {
        String[] url = new String[1];
        var e = against("", base -> {
            url[0] = base + "/api/v1/transactions/abc123";
            return assertThrows(RuntimeException.class, () -> CLIENT.get().uri(url[0]).retrieve().body(String.class));
        });
        assertTrue(Failures.expected(e), e.toString());
        assertTrue(Failures.reason(e).startsWith("GET " + url[0] + ": "), Failures.reason(e));
    }

    @Test
    void aRefusedConnectionIsSaidPlainly() throws Exception {
        int port;
        try (var s = new java.net.ServerSocket(0, 1, java.net.InetAddress.getLoopbackAddress())) {
            port = s.getLocalPort();
        }
        var e = assertThrows(RuntimeException.class, () -> CLIENT.get().uri("http://127.0.0.1:" + port + "/x").retrieve().body(String.class));
        assertEquals("Can't connect to http://127.0.0.1:" + port, Failures.reason(e));
    }

    @Test
    void anHttpErrorIsItsStatus() {
        assertEquals("HTTP 401 Unauthorized", Failures.reason(new IllegalStateException("wrapped",
                HttpClientErrorException.create(HttpStatus.UNAUTHORIZED, "Unauthorized", new HttpHeaders(), new byte[0], null))));
    }

    @Test
    void otherwiseTheInnermostMessage() {
        assertEquals("null value in column", Failures.reason(new IllegalStateException("outer", new DataIntegrityViolationException("null value in column"))));
        assertEquals("NullPointerException", Failures.reason(new NullPointerException()));
    }
}
