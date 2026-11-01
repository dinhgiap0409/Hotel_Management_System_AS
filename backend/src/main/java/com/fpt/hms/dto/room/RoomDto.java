package com.fpt.hms.dto.room;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomDto {
    private Integer roomId;
    private String roomNumber;
    private Integer floor;
    private Integer roomTypeId;
    private String roomTypeName;
    private BigDecimal basePrice;
    private String stayStatus;
    private String cleaningStatus;
    private String roomStatus;
    private String notes;

    // Backward-compatibility getters for frontend components
    @JsonProperty("status")
    public String getStatus() {
        return roomStatus;
    }

    @JsonProperty("cleanliness")
    public String getCleanliness() {
        return cleaningStatus;
    }

    @JsonProperty("roomType")
    public Map<String, Object> getRoomType() {
        return Map.of(
                "roomTypeId", roomTypeId != null ? roomTypeId : 0,
                "typeName", roomTypeName != null ? roomTypeName : ""
        );
    }
}
