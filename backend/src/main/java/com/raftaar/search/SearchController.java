package com.raftaar.search;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class SearchController {
    private final Search search;

    public SearchController(Search search) {
        this.search = search;
    }

    @GetMapping("/search")
    public List<Search.Hit> search(@RequestParam(defaultValue = "") String q) {
        return search.find(q);
    }
}
