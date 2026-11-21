package com.raftaar.common;

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
        AppSetting setting = repo.findById(key).orElseGet(AppSetting::new);
        setting.key = key;
        setting.value = value == null ? null : value.toString();
        repo.save(setting);
    }
}
