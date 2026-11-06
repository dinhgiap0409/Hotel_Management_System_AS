package com.fpt.hms.dto.billing_report;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FolioDetailDto {
    private Integer folioId;
    private Integer stayId;
    private String folioStatus; // OPEN, CLOSED
    private Integer reservationId;
    private String reservationCode;
    private String roomNumber;
    private String roomTypeName;
    private String guestName;
    private String guestPhone;
    private String guestEmail;
    private String guestIdNumber;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate checkInDate;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate checkOutDate;

    private Instant actualCheckIn;
    private Instant actualCheckOut;

    // Line items
    @Builder.Default
    private List<RoomNightItemDto> roomNights = new ArrayList<>();

    @Builder.Default
    private List<ServiceOrderDto> serviceOrders = new ArrayList<>();

    @Builder.Default
    private List<AdditionalChargeDto> additionalCharges = new ArrayList<>();

    @Builder.Default
    private List<DepositPaymentDto> depositPayments = new ArrayList<>();

    // Totals & Financial summary
    private BigDecimal roomSubtotal;
    private BigDecimal serviceSubtotal;
    private BigDecimal additionalSubtotal;
    private BigDecimal subtotal; // room + service + additional
    private BigDecimal depositPaid; // deposit payments already PAID
    private BigDecimal taxRate; // 8%
    private BigDecimal estimatedTax; // subtotal * 0.08
    private BigDecimal estimatedTotal; // subtotal + tax
    private BigDecimal estimatedBalance; // estimatedTotal - depositPaid

    // Invoice link if settled
    private Integer invoiceId;
    private String invoiceCode;
    private String invoiceStatus;
    private String voucherCode;
    private BigDecimal discountAmount;
    private BigDecimal settledAmount;
    private String paymentMethod;
    private Instant settledAt;
}

