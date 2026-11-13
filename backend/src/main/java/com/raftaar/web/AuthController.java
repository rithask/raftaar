package com.raftaar.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class AuthController {
    private final AuthenticationManager auth;
    private final SecurityContextRepository contexts;
    private final String version;

    public AuthController(AuthenticationManager auth, SecurityContextRepository contexts,
                          @org.springframework.beans.factory.annotation.Value("${app.version:dev}") String version) {
        this.auth = auth;
        this.contexts = contexts;
        this.version = version;
    }

    public record Login(String username, String password) {}

    @PostMapping("/auth/login")
    public ResponseEntity<?> login(@RequestBody Login body, HttpServletRequest req, HttpServletResponse res) {
        try {
            Authentication a = auth.authenticate(new UsernamePasswordAuthenticationToken(body.username(), body.password()));
            if (req.getSession(false) != null) req.changeSessionId(); // no session fixation
            var ctx = SecurityContextHolder.createEmptyContext();
            ctx.setAuthentication(a);
            SecurityContextHolder.setContext(ctx);
            contexts.saveContext(ctx, req, res);
            return ResponseEntity.ok(Map.of("username", a.getName()));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401).body(Map.of("error", "Wrong username or password"));
        }
    }

    /** Who's signed in; {@code username} is null when nobody is (a plain answer, not a 401, for the sign-in screen). */
    @GetMapping("/auth/me")
    public Map<String, Object> me(Authentication a) {
        boolean in = a != null && a.isAuthenticated() && !(a instanceof org.springframework.security.authentication.AnonymousAuthenticationToken);
        var out = new java.util.HashMap<String, Object>();
        out.put("username", in ? a.getName() : null);
        return out;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "version", version);
    }
}
