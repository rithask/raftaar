package com.raftaar.service;

import com.raftaar.domain.AppSetting;
import com.raftaar.repo.AppSettingRepo;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

/** Small key/value state: sync cursors, last run times and errors. */
@Service
public class Settings {
    private final AppSettingRepo repo;

    public Settings(AppSettingRepo repo) {
        this.repo = repo;
    }

    public Optional<String> get(String key) {
        return repo.findById(key).map(s -> s.value).filter(v -> !v.isBlank());
    }

    public Optional<Instant> instant(String key) {
        return get(key).map(Instant::parse);
    }

    public void set(String key, Object value) {
        AppSetting s = repo.findById(key).orElseGet(AppSetting::new);
        s.key = key;
        s.value = value == null ? null : value.toString();
        repo.save(s);
    }
}
