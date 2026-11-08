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
public class InvoiceDetailDto {
    private Integer invoiceId;
    private String invoiceCode;
    private Instant issueDate;
    private String status; // PAID, UNPAID, CANCELLED
    private Integer folioId;
    private Integer stayId;
    private String reservationCode;

    // Guest Info
    private String guestName;
    private String guestPhone;
    private String guestEmail;
    private String guestIdNumber;
    private String roomNumber;
    private String roomTypeName;

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

    // Financial breakdown
    private BigDecimal roomSubtotal;
    private BigDecimal serviceSubtotal;
    private BigDecimal additionalSubtotal;
    private BigDecimal totalAmount; // Gross subtotal before discount
    private String voucherCode;
    private BigDecimal discountAmount;
    private BigDecimal taxableAmount;
    private BigDecimal taxRate; // 8%
    private BigDecimal taxAmount;
    private BigDecimal depositDeducted;
    private BigDecimal finalAmount; // Total net invoice amount

    // Payment Info
    private String paymentMethod;
    private BigDecimal amountPaid;
    private Instant paidAt;
    private String cashierName;
    private String notes;
    private String specialNotes;
}

