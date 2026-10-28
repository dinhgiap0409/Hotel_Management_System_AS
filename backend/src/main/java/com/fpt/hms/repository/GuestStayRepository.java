package com.fpt.hms.repository;

import com.fpt.hms.entity.GuestStay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GuestStayRepository extends JpaRepository<GuestStay, Integer> {
    List<GuestStay> findByStatus(String status);
    Optional<GuestStay> findByReservation_ReservationId(Integer reservationId);
}