package com.raftaar.notifications;

import com.raftaar.common.EntityRepo;

import java.util.List;
import java.util.Optional;

public interface PushSubscriptionRepo extends EntityRepo<PushSubscription> {
    Optional<PushSubscription> findByEndpoint(String endpoint);
    List<PushSubscription> findAllByOrderByIdAsc();
}
