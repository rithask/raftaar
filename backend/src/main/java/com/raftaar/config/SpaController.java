package com.raftaar.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Serves the React app for client-side routes: anything without a dot that isn't /api, /assets or the OIDC endpoints
 * (/oauth2/..., /login/oauth2/...), which Spring Security answers.
 */
@Controller
public class SpaController {
    @GetMapping({"/", "/{a:^(?!api$|assets$|oauth2$|login$)[^.]+}", "/{a:^(?!api$|assets$|oauth2$|login$)[^.]+}/{b:[^.]+}", "/{a:^(?!api$|assets$|oauth2$|login$)[^.]+}/{b:[^.]+}/{c:[^.]+}"})
    public String index() {
        return "forward:/index.html";
    }
}
