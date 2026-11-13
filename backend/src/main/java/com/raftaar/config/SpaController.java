package com.raftaar.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/** Serves the React app for client-side routes (anything without a dot that isn't /api or /assets). */
@Controller
public class SpaController {
    @GetMapping({"/", "/{a:^(?!api$|assets$)[^.]+}", "/{a:^(?!api$|assets$)[^.]+}/{b:[^.]+}", "/{a:^(?!api$|assets$)[^.]+}/{b:[^.]+}/{c:[^.]+}"})
    public String index() {
        return "forward:/index.html";
    }
}
