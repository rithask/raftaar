package com.raftaar.settings;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/integrations")
public class IntegrationController {
    private final Integrations integrations;

    public IntegrationController(Integrations integrations) {
        this.integrations = integrations;
    }

    @GetMapping
    public List<Integrations.Integration> all() {
        return integrations.all();
    }

    @PostMapping("/{name}/run")
    public Map<String, String> run(@PathVariable String name) {
        return Map.of("result", integrations.run(name));
    }
}
