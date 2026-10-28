package com.fpt.hms.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "[Folio]")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Folio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "folio_id")
    private Integer folioId;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "stay_id", nullable = false, unique = true)
    private GuestStay guestStay;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "total_amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version = 0;

    @OneToMany(mappedBy = "folio", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<AdditionalCharge> additionalCharges = new ArrayList<>();
}
