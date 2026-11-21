package com.raftaar.inbox;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TripRepo extends JpaRepository<Trip, Long> {
    Optional<Trip> findByGeopulseId(Long id);
    List<Trip> findByStatusOrderByStartedAtDesc(Trip.Status status);
    List<Trip> findByVehicleIdOrderByStartedAtDesc(Long vehicleId);
    List<Trip> findByVehicleIdAndStatusAndEndedAtAfter(Long vehicleId, Trip.Status status, Instant after);
    List<Trip> findByStartedAtBetween(Instant from, Instant to);
    List<Trip> findByStopsCheckedFalseAndStatusNot(Trip.Status status);
    long countByStatus(Trip.Status status);
}
