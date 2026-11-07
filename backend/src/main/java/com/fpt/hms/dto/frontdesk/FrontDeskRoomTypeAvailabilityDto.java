package com.fpt.hms.dto.frontdesk;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Module 3B (Owner: TungPV) - Room Type Availability DTO for Front-Desk Walk-in Booking (UC-26).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FrontDeskRoomTypeAvailabilityDto {
    private Integer roomTypeId;
    private String typeName;
    private Integer capacity;
    private BigDecimal basePrice;
    private Integer totalActiveRooms;
    private Integer availableRoomsCount;
    private String imageUrl;
    private BigDecimal totalPeriodPrice;
    private List<DailyTariffDto> dailyTariffs;

    // Khoảng biểu giá gộp theo các ngày trong tuần (Ví dụ: "Thứ Hai - Thứ Năm": 850.000)
    private List<PriceRangeDto> priceRanges;
    private Map<String, BigDecimal> priceRangeMap;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PriceRangeDto {
        private String dayRange;       // Ví dụ: "Thứ Hai - Thứ Năm"
        private String shortRange;     // Ví dụ: "T2 - T5"
        private BigDecimal price;      // Ví dụ: 850000
        private Integer startDayOfWeek;
        private Integer endDayOfWeek;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class DailyTariffDto {
        private LocalDate stayDate;
        private Integer dayOfWeek;
        private String dayOfWeekName;
        private BigDecimal price;
    }
}
