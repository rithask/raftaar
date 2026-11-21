package com.raftaar.inbox;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface SuggestionRepo extends JpaRepository<Suggestion, Long> {
    Optional<Suggestion> findByHisaabTxnId(String id);
    List<Suggestion> findByStatusOrderByOccurredAtDesc(Suggestion.Status status);
    List<Suggestion> findByStatusAndHisaabTxnIdNotNull(Suggestion.Status status);
    List<Suggestion> findByKindAndOccurredAtBetween(Suggestion.Kind kind, Instant from, Instant to);
    long countByStatus(Suggestion.Status status);
}
