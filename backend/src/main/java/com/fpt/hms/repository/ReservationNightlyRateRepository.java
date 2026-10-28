package com.fpt.hms.repository;

import com.fpt.hms.entity.ReservationNightlyRate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReservationNightlyRateRepository extends JpaRepository<ReservationNightlyRate, Integer> {}