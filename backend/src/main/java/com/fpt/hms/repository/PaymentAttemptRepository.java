package com.fpt.hms.repository;

import com.fpt.hms.entity.PaymentAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentAttemptRepository extends JpaRepository<PaymentAttempt, Integer> {
    Optional<PaymentAttempt> findByGatewayRequestRef(String gatewayRequestRef);
}