package com.fpt.hms.repository;

import com.fpt.hms.entity.ReservationDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ReservationDetailRepository extends JpaRepository<ReservationDetail, Integer> {
    List<ReservationDetail> findByReservation_ReservationId(Integer reservationId);
}