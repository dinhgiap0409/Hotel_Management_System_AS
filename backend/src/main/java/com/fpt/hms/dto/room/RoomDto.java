package com.fpt.hms.dto.room;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

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
}