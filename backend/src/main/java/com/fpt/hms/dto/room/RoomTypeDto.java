package com.fpt.hms.dto.room;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomTypeDto {
    private Integer roomTypeId;
    private String typeName;
    private Integer capacity;
    private BigDecimal basePrice;
    private String amenities;
    private String description;
    private String imageUrl;
    /** Detail-gallery photo URLs (UC-22), comma-separated (Room_Type.gallery_images). */
    private String galleryImages;
    private Boolean isActive;

    @JsonProperty("status")
    public String getStatus() {
        return Boolean.TRUE.equals(isActive) ? "Active" : "Inactive";
    }
}
