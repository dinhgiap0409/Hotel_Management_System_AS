package com.fpt.hms.repository;

import com.fpt.hms.entity.Reservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReservationRepository extends JpaRepository<Reservation, Integer> {
    Optional<Reservation> findByReservationCode(String reservationCode);
    List<Reservation> findByCustomer_CustomerIdOrderByReservationDateDesc(Integer customerId);
    List<Reservation> findByStatusAndHoldExpiresAtBefore(String status, java.time.Instant now);

    /**
     * BR-12: upcoming reservations in the given statuses (PENDING / CONFIRMED)
     * whose stay has not ended yet. Used to check whether archiving a room
     * would strand a booking of the room's type.
     */
    List<Reservation> findByStatusInAndCheckOutDateGreaterThanEqual(List<String> statuses, LocalDate date);
}