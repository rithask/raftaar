package com.raftaar.common;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.NoRepositoryBean;

import java.util.NoSuchElementException;

/** A repository of entities with numeric ids, with "find it or answer 404". */
@NoRepositoryBean
public interface EntityRepo<T> extends JpaRepository<T, Long> {

    /** The entity with this id; otherwise a NoSuchElementException ("Vehicle not found"), which the API answers with 404. */
    default T require(Long id, String what) {
        return findById(id).orElseThrow(() -> new NoSuchElementException(what + " not found"));
    }
}
