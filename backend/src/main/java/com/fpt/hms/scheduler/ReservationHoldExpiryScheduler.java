package com.fpt.hms.scheduler;

import com.fpt.hms.entity.Reservation;
import com.fpt.hms.enums.ReservationStatus;
import com.fpt.hms.repository.ReservationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Scheduled job to auto-cancel PENDING reservations after 24 hours (SDD Section 2.3 & BR-19).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReservationHoldExpiryScheduler {

    private final ReservationRepository reservationRepository;

    @Scheduled(fixedDelay = 300000) // Runs every 5 minutes
    @Transactional
    public void cancelExpiredPendingReservations() {
        List<Reservation> expired = reservationRepository
                .findByStatusAndHoldExpiresAtBefore(ReservationStatus.PENDING.name(), Instant.now());
        if (!expired.isEmpty()) {
            expired.forEach(r -> r.setStatus(ReservationStatus.CANCELLED.name()));
            reservationRepository.saveAll(expired);
            log.info("Auto-cancelled {} expired PENDING reservations (BR-19).", expired.size());
        }
    }
}