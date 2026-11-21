package com.raftaar.inbox;


import java.time.Instant;
import java.util.List;
import java.util.Optional;
import com.raftaar.common.EntityRepo;

public interface SuggestionRepo extends EntityRepo<Suggestion> {
    Optional<Suggestion> findByHisaabTxnId(String id);
    List<Suggestion> findByStatusOrderByOccurredAtDesc(Suggestion.Status status);
    List<Suggestion> findByStatusAndHisaabTxnIdNotNull(Suggestion.Status status);
    List<Suggestion> findByKindAndOccurredAtBetween(Suggestion.Kind kind, Instant from, Instant to);
    long countByStatus(Suggestion.Status status);
}
