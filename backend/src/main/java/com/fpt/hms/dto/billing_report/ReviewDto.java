package com.fpt.hms.dto.billing_report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReviewDto {
    private Integer reviewId;
    private Integer stayId;
    private Integer reservationId;
    private String reservationCode;
    private Integer roomId;
    private String roomNumber;
    private Integer roomTypeId;
    private String roomTypeName;
    private String roomImageUrl;
    private Integer customerId;
    private String customerName;
    private String customerEmail;
    private Integer rating;
    private String comment;
    private Instant reviewDate;
    private Boolean isHidden;
    private String hiddenReason;
    private String managementReply;
    private Instant repliedAt;
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private Instant actualCheckIn;
    private Instant actualCheckOut;
    private String stayStatus;
}

