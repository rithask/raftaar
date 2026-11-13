package com.raftaar.repo;

import com.raftaar.domain.MapTile;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MapTileRepo extends JpaRepository<MapTile, String> {}
