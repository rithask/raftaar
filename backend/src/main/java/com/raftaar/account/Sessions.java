package com.raftaar.account;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** Starting and dropping the signed-in session. However you got in (password, provider, onboarding), you're the account. */
public final class Sessions {
    private Sessions() {}

    public static void signIn(HttpServletRequest req, HttpServletResponse res, SecurityContextRepository contexts, String username) {
        req.getSession(true);
        req.changeSessionId(); // a new id on every sign-in, so a planted session id is useless
        var a = new UsernamePasswordAuthenticationToken(username, null, List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
        var ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(a);
        SecurityContextHolder.setContext(ctx);
        contexts.saveContext(ctx, req, res);
    }

    /** Undoes a sign-in that was saved to the session (a provider sign-in that isn't allowed in, or not yet). */
    public static void drop(HttpServletRequest req) {
        SecurityContextHolder.clearContext();
        var s = req.getSession(false);
        if (s != null) s.removeAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
    }

    public static String loginError(String message) {
        return "/?login_error=" + URLEncoder.encode(message, StandardCharsets.UTF_8);
    }
}
