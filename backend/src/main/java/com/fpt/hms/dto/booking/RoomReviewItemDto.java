package com.fpt.hms.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Module 3A (Owner: GiapND) - Verified Guest Review item for UC-22.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomReviewItemDto {
    private Integer reviewId;
    private String customerName;
    private Integer rating;
    private String comment;
    private Instant reviewDate;
    private String managementReply;
    private Instant repliedAt;
    private String roomNumber;
}

