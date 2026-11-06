package com.fpt.hms.dto.billing_report;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * Module 4 (Owner: LinhNH) - DTO for room stay selection and Folio billing management.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActiveStaySelectDto {
    private Integer stayId;
    private Integer reservationId;
    private String roomNumber;
    private String guestName;
    private String phoneNumber;
    private String reservationCode;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate checkInDate;

    @JsonFormat(pattern = "yyyy-MM-dd")
    private LocalDate checkOutDate;

    private Instant actualCheckIn;
    private Instant actualCheckOut;

    private String folioStatus;
    private BigDecimal totalAmount;
    private String specialNotes;
}
