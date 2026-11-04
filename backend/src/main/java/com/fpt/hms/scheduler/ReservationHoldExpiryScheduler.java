package com.fpt.hms.scheduler;

import com.fpt.hms.entity.Payment;
import com.fpt.hms.entity.Reservation;
import com.fpt.hms.enums.ReservationStatus;
import com.fpt.hms.repository.PaymentAttemptRepository;
import com.fpt.hms.repository.PaymentRepository;
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
    private final PaymentRepository paymentRepository;
    private final PaymentAttemptRepository paymentAttemptRepository;

    @Scheduled(fixedDelay = 15000) // Runs every 15 seconds to promptly release expired holds
    @Transactional
    public void cancelExpiredPendingReservations() {
        Instant now = Instant.now();
        List<Reservation> expired = reservationRepository
                .findByStatusAndHoldExpiresAtBefore(ReservationStatus.PENDING.name(), now);
        if (!expired.isEmpty()) {
            for (Reservation r : expired) {
                r.setStatus(ReservationStatus.CANCELLED.name());

                List<Payment> payments = paymentRepository.findByReservation_ReservationId(r.getReservationId());
                for (Payment p : payments) {
                    if ("PENDING".equalsIgnoreCase(p.getStatus())) {
                        p.setStatus("FAILED");
                    }
                }
                paymentRepository.saveAll(payments);

                paymentAttemptRepository.findByGatewayRequestRef(r.getReservationCode())
                        .ifPresent(attempt -> {
                            if ("PENDING".equalsIgnoreCase(attempt.getStatus())) {
                                attempt.setStatus("EXPIRED");
                                attempt.setExpiredAt(now);
                                paymentAttemptRepository.save(attempt);
                            }
                        });
            }
            reservationRepository.saveAll(expired);
            log.info("Auto-cancelled {} expired PENDING reservations (BR-19).", expired.size());
        }
    }
}
