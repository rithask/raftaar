package com.raftaar.repo;

import com.raftaar.domain.NotificationChannel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NotificationChannelRepo extends JpaRepository<NotificationChannel, Long> {
    List<NotificationChannel> findAllByOrderByIdAsc();
    List<NotificationChannel> findByEnabledTrueOrderByIdAsc();
}
