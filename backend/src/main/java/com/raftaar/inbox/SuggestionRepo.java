package com.raftaar.inbox;


import java.time.Instant;
import java.util.List;
import java.util.Optional;
import com.raftaar.common.EntityRepo;
import org.springframework.data.domain.Limit;

public interface SuggestionRepo extends EntityRepo<Suggestion> {
    Optional<Suggestion> findByHisaabTxnId(String id);
    List<Suggestion> findByStatusOrderByOccurredAtDesc(Suggestion.Status status);
    List<Suggestion> findByStatusAndHisaabTxnIdNotNull(Suggestion.Status status);
    List<Suggestion> findByKindAndOccurredAtBetween(Suggestion.Kind kind, Instant from, Instant to);
    /** Handled ones (not pending), newest first, from before {@code before}. */
    List<Suggestion> findByStatusNotAndOccurredAtBeforeOrderByOccurredAtDescIdDesc(Suggestion.Status status, Instant before, Limit limit);
    List<Suggestion> findByStatusNotAndOccurredAtOrderByIdDesc(Suggestion.Status status, Instant at);
    long countByStatus(Suggestion.Status status);
}
