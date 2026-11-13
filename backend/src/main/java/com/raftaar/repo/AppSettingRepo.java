package com.raftaar.repo;

import com.raftaar.domain.AppSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppSettingRepo extends JpaRepository<AppSetting, String> {}
