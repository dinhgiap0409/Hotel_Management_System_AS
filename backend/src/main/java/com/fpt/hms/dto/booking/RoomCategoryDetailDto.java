package com.fpt.hms.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Module 3A (Owner: GiapND) - Detailed Room Category View DTO (UC-22: View Room Details).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomCategoryDetailDto {
    private Integer roomTypeId;
    private String typeName;
    private Integer capacity;
    private BigDecimal basePrice;
    private String bedLayout;
    private String amenities;
    private List<String> amenitiesList;
    private String description;
    private String imageUrl;
    private List<String> photoGallery;
    private Boolean isActive;
    private Integer totalActiveRooms;
    private Integer availableRoomsCount;
    private List<Integer> floorNumbers;
    private List<String> sampleRoomNumbers;
    private Double averageRating;
    private Integer reviewCount;
    private Long nights;
    private BigDecimal estimatedTotal;
    private List<DayOfWeekRateDto> dayOfWeekRates;
    private List<RoomReviewItemDto> verifiedReviews;
}

