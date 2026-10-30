package com.fpt.hms.service.impl;

import com.fpt.hms.common.MessageResolver;
import com.fpt.hms.dto.billing_report.InvoiceDto;
import com.fpt.hms.dto.billing_report.ServiceOrderRequest;
import com.fpt.hms.entity.*;
import com.fpt.hms.enums.GuestStayStatus;
import com.fpt.hms.enums.InvoiceStatus;
import com.fpt.hms.enums.PaymentStatus;
import com.fpt.hms.enums.ServiceOrderStatus;
import com.fpt.hms.exception.BusinessException;
import com.fpt.hms.exception.ResourceNotFoundException;
import com.fpt.hms.repository.*;
import com.fpt.hms.service.BillingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Module 4 (Owner: LinhNH) - Ancillary Services & Folio Billing Service (UC-31 to UC-40).
 */
@Service
@RequiredArgsConstructor
public class BillingServiceImpl implements BillingService {

    private final HotelServiceRepository hotelServiceRepository;
    private final GuestStayRepository guestStayRepository;
    private final ServiceOrderRepository serviceOrderRepository;
    private final FolioRepository folioRepository;
    private final VoucherRepository voucherRepository;
    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;
    private final MessageResolver messageResolver;

    @Override
    @Transactional(readOnly = true)
    public List<HotelService> getActiveServices() {
        return hotelServiceRepository.findByStatus("ACTIVE");
    }

    @Override
    @Transactional
    public void orderServiceToFolio(ServiceOrderRequest request) {
        GuestStay stay = guestStayRepository.findById(request.getStayId())
                .orElseThrow(() -> new ResourceNotFoundException("Stay not found"));

        if (!GuestStayStatus.ACTIVE.name().equalsIgnoreCase(stay.getStatus())) {
            throw new BusinessException("MSG11", messageResolver.resolve("MSG11"));
        }

        HotelService service = hotelServiceRepository.findById(request.getServiceId())
                .orElseThrow(() -> new ResourceNotFoundException("Hotel service not found"));

        // BR-27: Snapshot unit_price at ordering time
        ServiceOrder order = ServiceOrder.builder()
                .guestStay(stay)
                .hotelService(service)
                .orderTime(Instant.now())
                .quantity(request.getQuantity())
                .unitPrice(service.getUnitPrice())
                .status(ServiceOrderStatus.COMPLETED.name())
                .completedAt(Instant.now())
                .build();
        serviceOrderRepository.save(order);

        Folio folio = folioRepository.findByGuestStay_StayId(stay.getStayId())
                .orElseThrow(() -> new ResourceNotFoundException("Folio not found"));

        BigDecimal lineAmount = service.getUnitPrice().multiply(BigDecimal.valueOf(request.getQuantity()));
        folio.setTotalAmount(folio.getTotalAmount().add(lineAmount));
        folioRepository.save(folio);
    }

    @Override
    @Transactional
    public InvoiceDto compileAndSettleInvoice(Integer stayId, String voucherCode, String paymentMethod) {
        Folio folio = folioRepository.findByGuestStay_StayId(stayId)
                .orElseThrow(() -> new ResourceNotFoundException("Folio not found for stayId: " + stayId));

        BigDecimal subtotal = folio.getTotalAmount();
        BigDecimal discount = BigDecimal.ZERO;
        Voucher appliedVoucher = null;

        if (voucherCode != null && !voucherCode.isBlank()) {
            Voucher v = voucherRepository.findByCodeIgnoreCase(voucherCode.trim())
                    .orElseThrow(() -> new BusinessException("MSG09", messageResolver.resolve("MSG09")));
            Instant now = Instant.now();
            if (!"ACTIVE".equalsIgnoreCase(v.getStatus())
                    || now.isBefore(v.getValidFrom())
                    || now.isAfter(v.getValidTo())
                    || v.getUsedCount() >= v.getUsageLimit()
                    || subtotal.compareTo(v.getMinSpend()) < 0) {
                throw new BusinessException("MSG09", messageResolver.resolve("MSG09"));
            }
            if ("PERCENTAGE".equalsIgnoreCase(v.getDiscountType())) {
                discount = subtotal.multiply(v.getDiscountValue())
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                if (v.getMaxDiscountAmount().compareTo(BigDecimal.ZERO) > 0
                        && discount.compareTo(v.getMaxDiscountAmount()) > 0) {
                    discount = v.getMaxDiscountAmount();
                }
            } else {
                discount = v.getDiscountValue();
            }
            v.setUsedCount(v.getUsedCount() + 1);
            appliedVoucher = voucherRepository.save(v);
        }

        BigDecimal taxable = subtotal.subtract(discount).max(BigDecimal.ZERO);
        BigDecimal tax = taxable.multiply(new BigDecimal("0.08")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal finalAmount = taxable.add(tax);

        Invoice invoice = invoiceRepository.findByFolio_FolioId(folio.getFolioId())
                .orElseGet(() -> Invoice.builder()
                        .folio(folio)
                        .invoiceCode("INV-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase())
                        .build());

        invoice.setVoucher(appliedVoucher);
        invoice.setTotalAmount(subtotal);
        invoice.setDiscountAmount(discount);
        invoice.setTaxAmount(tax);
        invoice.setFinalAmount(finalAmount);
        invoice.setStatus(InvoiceStatus.PAID.name());
        invoice.setIssueDate(Instant.now());
        Invoice savedInvoice = invoiceRepository.save(invoice);

        Payment payment = Payment.builder()
                .invoice(savedInvoice)
                .reservation(folio.getGuestStay().getReservation())
                .paymentType("SETTLEMENT")
                .amount(finalAmount)
                .currency("VND")
                .method(paymentMethod != null ? paymentMethod.toUpperCase() : "CASH")
                .status(PaymentStatus.PAID.name())
                .createdAt(Instant.now())
                .paidAt(Instant.now())
                .build();
        paymentRepository.save(payment);

        return InvoiceDto.builder()
                .invoiceId(savedInvoice.getInvoiceId())
                .invoiceCode(savedInvoice.getInvoiceCode())
                .folioId(folio.getFolioId())
                .totalAmount(savedInvoice.getTotalAmount())
                .discountAmount(savedInvoice.getDiscountAmount())
                .taxAmount(savedInvoice.getTaxAmount())
                .finalAmount(savedInvoice.getFinalAmount())
                .voucherCode(appliedVoucher != null ? appliedVoucher.getCode() : null)
                .status(savedInvoice.getStatus())
                .issueDate(savedInvoice.getIssueDate())
                .build();
    }
}