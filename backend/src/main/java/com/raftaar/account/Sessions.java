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

    public static void signIn(HttpServletRequest request, HttpServletResponse response, SecurityContextRepository contexts, String username) {
        request.getSession(true);
        request.changeSessionId(); // a new id on every sign-in, so a planted session id is useless
        var authentication = new UsernamePasswordAuthenticationToken(username, null, List.of(new SimpleGrantedAuthority("ROLE_OWNER")));
        var ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(authentication);
        SecurityContextHolder.setContext(ctx);
        contexts.saveContext(ctx, request, response);
    }

    /** Undoes a sign-in that was saved to the session (a provider sign-in that isn't allowed in, or not yet). */
    public static void drop(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        var session = request.getSession(false);
        if (session != null) session.removeAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
    }

    public static String loginError(String message) {
        return "/?login_error=" + URLEncoder.encode(message, StandardCharsets.UTF_8);
    }
}
