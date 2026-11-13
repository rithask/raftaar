package com.raftaar.repo;

import com.raftaar.domain.Geocode;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GeocodeRepo extends JpaRepository<Geocode, String> {}
