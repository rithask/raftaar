package com.raftaar.notifications;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

import java.time.Instant;

/** A phone or browser that gets notifications by Web Push: where to send them, and its keys to encrypt them with. */
@Entity
@Table(name = "push_subscription")
public class PushSubscription {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;
    /** The push service's address for this browser; it also tells a browser its own subscription apart. */
    public String endpoint;
    @JsonIgnore public String p256dh;
    @JsonIgnore public String auth;
    /** "iPhone · Safari", from the browser that turned it on. */
    public String label;
    public Instant lastSentAt;
    public Boolean lastOk;
    public String lastError;
    public Instant createdAt = Instant.now();
}
