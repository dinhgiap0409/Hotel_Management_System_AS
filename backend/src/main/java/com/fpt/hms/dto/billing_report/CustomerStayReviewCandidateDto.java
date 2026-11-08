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
public class CustomerStayReviewCandidateDto {
    private Integer stayId;
    private Integer reservationId;
    private String reservationCode;
    private Integer roomId;
    private String roomNumber;
    private Integer roomTypeId;
    private String roomTypeName;
    private String roomImageUrl;
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private Instant actualCheckIn;
    private Instant actualCheckOut;
    private long nights;
    private String stayStatus;
    private boolean canReview;
    private ReviewDto existingReview;
}

