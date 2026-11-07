package com.fpt.hms.repository;

import com.fpt.hms.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Integer> {
    Optional<Invoice> findByFolio_FolioId(Integer folioId);
    Optional<Invoice> findByFolio_GuestStay_StayId(Integer stayId);
    Optional<Invoice> findByInvoiceCode(String invoiceCode);
}