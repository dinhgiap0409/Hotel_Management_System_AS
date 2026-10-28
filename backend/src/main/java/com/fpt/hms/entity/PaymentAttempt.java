package com.fpt.hms.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "[Payment_Attempt]")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "attempt_id")
    private Integer attemptId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "payment_id", nullable = false)
    private Payment payment;

    @Column(name = "gateway_provider", nullable = false, length = 100)
    private String gatewayProvider;

    @Column(name = "gateway_request_ref", nullable = false, unique = true, length = 100)
    private String gatewayRequestRef;

    @Column(name = "gateway_transaction_id", length = 100)
    private String gatewayTransactionId;

    @Column(name = "bank_code", length = 50)
    private String bankCode;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "expired_at")
    private Instant expiredAt;

    @Column(name = "completed_at")
    private Instant completedAt;
}
