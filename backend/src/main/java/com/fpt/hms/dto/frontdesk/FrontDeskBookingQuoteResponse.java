package com.fpt.hms.dto.frontdesk;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FrontDeskBookingQuoteResponse {
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private String checkInDayOfWeek;
    private String checkOutDayOfWeek;
    private int totalNights;
    private int totalRoomsCount;
    private int totalCapacity;

    private List<QuoteRoomTypeItemDto> items;

    private BigDecimal totalRoomCharge;
    private BigDecimal grandTotal;
    private String note;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuoteRoomTypeItemDto {
        private Integer roomTypeId;
        private String typeName;
        private int quantity;
        private int capacityPerRoom;
        private int lineCapacity;
        private BigDecimal periodPricePerRoom;
        private BigDecimal lineTotal;

        // Chi tiết từng khoảng ngày hoặc từng đêm trong thời gian đặt
        private List<QuoteDailyBreakdownDto> breakdowns;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class QuoteDailyBreakdownDto {
        private String periodLabel;
        private String shortLabel;        // Ví dụ: "T7, 07/11 (Cuối tuần)" hoặc "T2, 09/11 – T3, 10/11"
        private int nights;               // Số đêm
        private BigDecimal unitPrice;     // Đơn giá / đêm
        private BigDecimal subtotalPerRoom; // = unitPrice * nights
        private String explanation;
        private boolean isWeekend;
    }
}

