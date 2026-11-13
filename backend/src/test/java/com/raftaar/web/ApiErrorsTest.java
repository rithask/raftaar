package com.raftaar.web;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.*;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Every error comes back as {"error": "..."} with the right status; a bug is a plain 500. */
class ApiErrorsTest {

    @RestController
    static class Probe {
        record In(String name) {}

        @GetMapping("/bug") String bug() { throw new NullPointerException("secret internals"); }
        @GetMapping("/bad") String bad() { throw new IllegalArgumentException("Give it a name"); }
        @GetMapping("/gone") String gone() { throw ApiErrors.notFound("Vehicle"); }
        @PostMapping("/json") String json(@RequestBody In in) { return in.name(); }
    }

    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new Probe()).setControllerAdvice(new ApiErrors()).build();

    @Test
    void aBugIsA500WithoutInternals() throws Exception {
        mvc.perform(get("/bug")).andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("Something went wrong on the server. It's in the logs."));
    }

    @Test
    void ourOwnErrorsKeepTheirMessage() throws Exception {
        mvc.perform(get("/bad")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").value("Give it a name"));
        mvc.perform(get("/gone")).andExpect(status().isNotFound()).andExpect(jsonPath("$.error").value("Vehicle not found"));
    }

    @Test
    void springsRequestErrorsKeepTheirStatusInOurShape() throws Exception {
        mvc.perform(post("/json").contentType(MediaType.APPLICATION_JSON).content("{oops"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.error").exists());
        mvc.perform(delete("/bad")).andExpect(status().isMethodNotAllowed()).andExpect(jsonPath("$.error").value(org.hamcrest.Matchers.containsString("DELETE")));
    }
}
