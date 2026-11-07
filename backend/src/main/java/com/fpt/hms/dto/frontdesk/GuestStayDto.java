package com.fpt.hms.dto.frontdesk;

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
public class GuestStayDto {
    private Integer stayId;
    private Integer reservationId;
    private String reservationCode;
    private String guestName;
    private String guestIdNumber;
    private String roomNumber;
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private Instant actualCheckIn;
    private Instant actualCheckOut;
    private String status;
    private Integer folioId;
    private BigDecimal folioTotalAmount;
    private Integer roomTypeId;
    private String roomTypeName;
    private BigDecimal roomPrice;
}