package com.fpt.hms.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

/**
 * Module 3A (Owner: GiapND) - Public Accommodation Category Card DTO (UC-14 & UC-21).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicRoomCategoryDto {
    private Integer roomTypeId;
    private String typeName;
    private Integer capacity;
    private BigDecimal basePrice;
    private String amenities;
    private List<String> amenitiesList;
    private String description;
    private String imageUrl;
    private Boolean isActive;
    private Integer totalActiveRooms;
    private Integer availableRoomsCount;
    private Double averageRating;
    private Integer reviewCount;
    private BigDecimal estimatedTotal;
    private Long nights;
}

