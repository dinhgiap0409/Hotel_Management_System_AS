package com.fpt.hms.dto.billing_report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Module 4 (Owner: LinhNH) - Lightweight DTO for room stay dropdown selection when ordering services.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ActiveStaySelectDto {
    private Integer stayId;
    private String roomNumber;
    private String guestName;
    private String reservationCode;
    private String specialNotes;
}

