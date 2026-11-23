package com.raftaar.inbox;


import java.time.Instant;
import java.util.List;
import java.util.Optional;
import com.raftaar.common.EntityRepo;
import org.springframework.data.domain.Limit;
import java.util.Collection;

public interface TripRepo extends EntityRepo<Trip> {
    Optional<Trip> findByGeopulseId(Long id);
    List<Trip> findByStatusOrderByStartedAtDesc(Trip.Status status);
    List<Trip> findByVehicleIdOrderByStartedAtDesc(Long vehicleId);
    List<Trip> findByVehicleIdAndStatusAndEndedAtAfter(Long vehicleId, Trip.Status status, Instant after);
    List<Trip> findByVehicleIdInAndStatusAndEndedAtAfter(Collection<Long> vehicleIds, Trip.Status status, Instant after);
    List<Trip> findByStartedAtBetween(Instant from, Instant to);
    List<Trip> findByStopsCheckedFalseAndStatusNot(Trip.Status status);
    /** Sorted ones (on a vehicle or not mine), newest first, from before {@code before}. */
    List<Trip> findByStatusNotAndStartedAtBeforeOrderByStartedAtDescIdDesc(Trip.Status status, Instant before, Limit limit);
    List<Trip> findByStatusNotAndStartedAtOrderByIdDesc(Trip.Status status, Instant at);
    long countByStatus(Trip.Status status);
}
