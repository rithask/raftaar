package com.raftaar.common;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Every API error comes back as {"error": "..."}. Mistakes in a request (bad input, not found, file too big) are
 * answered without logging; anything else is a bug, logged with its stack trace and answered with a plain 500.
 */
@RestControllerAdvice
public class ApiErrors extends ResponseEntityExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiErrors.class);

    public static ResponseStatusException notFound(String what) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, what + " not found");
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<Map<String, String>> status(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode()).body(Map.of("error", e.getReason() == null ? "Request failed" : e.getReason()));
    }

    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    ResponseEntity<Map<String, String>> bad(RuntimeException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage() == null ? "That can't be done" : e.getMessage()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<Map<String, String>> missing(NoSuchElementException e) {
        return ResponseEntity.status(404).body(Map.of("error", e.getMessage() == null ? "Not found" : e.getMessage()));
    }

    /** Anything else is a bug: log it with the request and stack trace, and don't show internals to the browser. */
    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, String>> unexpected(Exception e, HttpServletRequest req) {
        log.error("{} {} failed", req.getMethod(), req.getRequestURI(), e);
        return ResponseEntity.status(500).body(Map.of("error", "Something went wrong on the server. It's in the logs."));
    }

    // ---- Spring's own request errors (bad JSON, wrong method, missing parameter, file too big, the browser going
    // away mid-answer...), handled by ResponseEntityExceptionHandler ------------------------------------------------

    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(MaxUploadSizeExceededException e, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return ResponseEntity.status(413).body(Map.of("error", "That file is too big (15 MB at most)"));
    }

    /** Spring's own request errors keep their status, with the message in the same shape as ours. */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception e, Object body, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        if (status.is5xxServerError()) log.error("{} failed", request.getDescription(false), e);
        else log.debug("Bad request ({}): {}", status.value(), e.getMessage());
        String message = body instanceof ProblemDetail p && p.getDetail() != null ? p.getDetail()
                : e instanceof ErrorResponse r && r.getBody().getDetail() != null ? r.getBody().getDetail()
                : HttpStatus.resolve(status.value()) != null ? HttpStatus.resolve(status.value()).getReasonPhrase() : "Bad request";
        return ResponseEntity.status(status).headers(headers).body(Map.of("error", message));
    }
}
