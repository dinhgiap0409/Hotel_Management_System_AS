package com.fpt.hms.repository;

import com.fpt.hms.entity.Folio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FolioRepository extends JpaRepository<Folio, Integer> {
    Optional<Folio> findByGuestStay_StayId(Integer stayId);
}