package com.raftaar.inbox;

import com.raftaar.vehicle.VehicleRepo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** GeoPulse trips: putting them on a vehicle, or marking them as not on any of yours. */
@Service
public class Trips {
    private final TripRepo trips;
    private final VehicleRepo vehicles;

    public Trips(TripRepo trips, VehicleRepo vehicles) {
        this.trips = trips;
        this.vehicles = vehicles;
    }

    public List<Trip> forVehicle(Long vehicleId) {
        return trips.findByVehicleIdOrderByStartedAtDesc(vehicleId);
    }

    /** {@code vehicleId} null means "not on any of my vehicles": the trip is ignored. */
    public Trip assign(Long tripId, Long vehicleId) {
        Trip trip = trips.require(tripId, "Trip");
        if (vehicleId == null) {
            trip.status = Trip.Status.IGNORED;
            trip.vehicleId = null;
        } else {
            vehicles.require(vehicleId, "Vehicle");
            trip.status = Trip.Status.ASSIGNED;
            trip.vehicleId = vehicleId;
        }
        return trips.save(trip);
    }

    @Transactional
    public int assignAll(List<Long> tripIds, Long vehicleId) {
        tripIds.forEach(tripId -> assign(tripId, vehicleId));
        return tripIds.size();
    }

    /** Back to the Inbox. */
    public Trip unassign(Long tripId) {
        Trip trip = trips.require(tripId, "Trip");
        trip.status = Trip.Status.PENDING;
        trip.vehicleId = null;
        return trips.save(trip);
    }
}
