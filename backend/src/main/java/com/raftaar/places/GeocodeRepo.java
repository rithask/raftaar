package com.raftaar.places;

import org.springframework.data.jpa.repository.JpaRepository;

public interface GeocodeRepo extends JpaRepository<Geocode, String> {}
