package com.fpt.hms.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "[Reservation_Nightly_Rate]")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReservationNightlyRate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "nightly_rate_id")
    private Integer nightlyRateId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_detail_id", nullable = false)
    private ReservationDetail reservationDetail;

    @Column(name = "stay_date", nullable = false)
    private LocalDate stayDate;

    @Column(name = "unit_price", nullable = false, precision = 18, scale = 2)
    private BigDecimal unitPrice;
}
