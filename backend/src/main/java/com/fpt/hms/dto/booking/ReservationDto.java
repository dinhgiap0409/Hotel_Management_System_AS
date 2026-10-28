package com.fpt.hms.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReservationDto {
    private Integer reservationId;
    private String reservationCode;
    private String roomTypeName;
    private Integer roomQuantity;
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private long nights;
    private Integer guestCount;
    private String contactName;
    private String contactEmail;
    private String contactPhone;
    private String status;
    private BigDecimal estimatedTotal;
    private Instant holdExpiresAt;
}