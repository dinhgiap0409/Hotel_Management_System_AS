package com.fpt.hms.dto.frontdesk;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FrontDeskBookingQuoteRequest {

    @NotNull(message = "Ngày nhận phòng không được để trống")
    private LocalDate checkInDate;

    @NotNull(message = "Ngày trả phòng không được để trống")
    private LocalDate checkOutDate;

    private Integer guestCount;

    @NotEmpty(message = "Vui lòng chọn ít nhất một hạng phòng")
    private List<SelectedRoomItem> roomItems;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SelectedRoomItem {
        @NotNull(message = "roomTypeId không được để trống")
        private Integer roomTypeId;

        private int quantity;
    }
}

