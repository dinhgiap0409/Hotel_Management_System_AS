package com.fpt.hms.repository;

import com.fpt.hms.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Integer> {
    Optional<Reservation> findByReservationCode(String reservationCode);
    List<Reservation> findByCustomer_CustomerIdOrderByReservationDateDesc(Integer customerId);
    List<Reservation> findByStatusAndHoldExpiresAtBefore(String status, java.time.Instant now);
}