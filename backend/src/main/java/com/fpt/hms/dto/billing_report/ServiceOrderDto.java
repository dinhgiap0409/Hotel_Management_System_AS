package com.fpt.hms.dto.billing_report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Module 4 (Owner: LinhNH) - Flat view of a service order (UC-35, UC-36); avoids serializing lazy JPA proxies.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServiceOrderDto {
    private Integer serviceOrderId;
    private Integer stayId;
    private String roomNumber;
    private String reservationCode;
    private String guestName;
    private Integer serviceId;
    private String serviceName;
    private String category;
    private String billingUnit;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal totalAmount;
    private Instant orderTime;
    private Instant completedAt;
    private Instant cancelledAt;
    private String cancelReason;
    private String notes;
    private Boolean staffConfirmed;
    private String status;
}

