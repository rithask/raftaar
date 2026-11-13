package com.raftaar.integration;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRequest;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;

import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;

/**
 * Puts the request ("GET https://host/path") on any I/O failure of an outside call: while sending, waiting, or
 * reading the answer. Spring only names the request for some of these; a response that breaks off partway (a reset
 * stream, a dropped connection) otherwise reaches the log as just "Received RST_STREAM: Internal error", with no way
 * to tell which call it was or to find it in the other side's logs.
 */
public class NamedRequests implements ClientHttpRequestInterceptor {

    /** An I/O failure of one request; its message starts with the request. */
    public static class Failed extends IOException {
        private final String request;

        Failed(String request, IOException cause) {
            super(request + ": " + cause.getMessage(), cause);
            this.request = request;
        }

        /** "GET https://host/path?query" */
        public String request() {
            return request;
        }
    }

    @Override
    public ClientHttpResponse intercept(HttpRequest req, byte[] body, ClientHttpRequestExecution execution) throws IOException {
        String name = req.getMethod() + " " + req.getURI();
        try {
            return new Named(execution.execute(req, body), name);
        } catch (Failed e) {
            throw e;
        } catch (IOException e) {
            throw new Failed(name, e);
        }
    }

    /** The response, with failures while reading its body named too. */
    private record Named(ClientHttpResponse response, String name) implements ClientHttpResponse {
        @Override
        public HttpStatusCode getStatusCode() throws IOException {
            return response.getStatusCode();
        }

        @Override
        public String getStatusText() throws IOException {
            return response.getStatusText();
        }

        @Override
        public HttpHeaders getHeaders() {
            return response.getHeaders();
        }

        @Override
        public InputStream getBody() throws IOException {
            InputStream in;
            try {
                in = response.getBody();
            } catch (IOException e) {
                throw new Failed(name, e);
            }
            return new FilterInputStream(in) {
                @Override
                public int read() throws IOException {
                    try {
                        return super.read();
                    } catch (Failed e) {
                        throw e;
                    } catch (IOException e) {
                        throw new Failed(name, e);
                    }
                }

                @Override
                public int read(byte[] b, int off, int len) throws IOException {
                    try {
                        return super.read(b, off, len);
                    } catch (Failed e) {
                        throw e;
                    } catch (IOException e) {
                        throw new Failed(name, e);
                    }
                }
            };
        }

        @Override
        public void close() {
            response.close();
        }
    }
}
