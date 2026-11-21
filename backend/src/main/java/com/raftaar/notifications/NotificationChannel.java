package com.raftaar.notifications;

import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "notification_channel")
public class NotificationChannel {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    public String label;
    public String url;
    public boolean enabled = true;
    public Instant lastSentAt;
    public Boolean lastOk;
    public String lastError;
    public Instant createdAt = Instant.now();
}
