package com.fpt.hms.repository;

import com.fpt.hms.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Integer> {
    List<Payment> findByInvoice_InvoiceId(Integer invoiceId);
    List<Payment> findByReservation_ReservationId(Integer reservationId);
}