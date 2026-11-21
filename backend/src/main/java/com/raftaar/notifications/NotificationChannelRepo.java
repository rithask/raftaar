package com.raftaar.notifications;


import java.util.List;
import com.raftaar.common.EntityRepo;

public interface NotificationChannelRepo extends EntityRepo<NotificationChannel> {
    List<NotificationChannel> findAllByOrderByIdAsc();
    List<NotificationChannel> findByEnabledTrueOrderByIdAsc();
}
