package com.fpt.hms.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReservationDto {
    private Integer reservationId;
    private String reservationCode;
    private Integer roomTypeId;
    private String roomTypeName;
    private String roomImageUrl;
    private Integer roomQuantity;
    private LocalDate checkInDate;
    private LocalDate checkOutDate;
    private long nights;
    private Integer guestCount;
    private String contactName;
    private String contactEmail;
    private String contactPhone;
    private String specialNotes;
    private String status;
    private BigDecimal estimatedTotal;
    private BigDecimal depositAmount;
    private String depositPaymentStatus;
    private String vnpayPaymentUrl;
    private Instant reservationDate;
    private Instant holdExpiresAt;
    private List<NightlyRateItemDto> nightlyBreakdown;
    private List<BookedRoomDetailDto> bookedDetails;
    private Integer checkedInRoomsCount;
    private Integer totalBookedRoomsCount;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BookedRoomDetailDto {
        private Integer roomTypeId;
        private String roomTypeName;
        private Integer quantity;
        private BigDecimal unitPrice;
        private List<String> checkedInRoomNumbers;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class NightlyRateItemDto {
        private LocalDate stayDate;
        private String dayLabel;
        private BigDecimal unitPrice;
        private Integer quantity;
        private BigDecimal lineTotal;
    }
}
