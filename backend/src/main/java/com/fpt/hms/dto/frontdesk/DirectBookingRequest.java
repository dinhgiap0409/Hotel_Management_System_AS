package com.fpt.hms.dto.frontdesk;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
public class DirectBookingRequest {

    // Hỗ trợ chọn nhiều hạng phòng khác nhau trong 1 đơn
    private List<SelectedRoomItem> roomItems;

    // Fallback nếu đặt 1 hạng phòng đơn lẻ
    private Integer roomTypeId;
    @Builder.Default
    private int quantity = 1;

    @NotNull(message = "Vui lòng chọn ngày nhận phòng (Check-in)")
    private LocalDate checkInDate;

    @NotNull(message = "Vui lòng chọn ngày trả phòng (Check-out)")
    private LocalDate checkOutDate;

    // Số khách có thể tự động tính theo sức chứa phòng
    @Builder.Default
    private int guestCount = 0;

    @NotBlank(message = "Họ và tên khách hàng không được để trống")
    @Size(max = 100, message = "Họ và tên tối đa 100 ký tự")
    private String contactName;

    @NotBlank(message = "Số điện thoại liên hệ không được để trống")
    @Size(max = 20, message = "Số điện thoại tối đa 20 ký tự")
    private String contactPhone;

    @Email(message = "Định dạng Email không hợp lệ")
    @Size(max = 254, message = "Email tối đa 254 ký tự")
    private String contactEmail;

    @Size(max = 50, message = "Số CCCD/Hộ chiếu tối đa 50 ký tự")
    private String guestIdNumber;

    @Size(max = 500, message = "Ghi chú đặc biệt tối đa 500 ký tự")
    private String specialNotes;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SelectedRoomItem {
        @NotNull(message = "Vui lòng chọn hạng phòng")
        private Integer roomTypeId;

        @Min(value = 1, message = "Số lượng phòng tối thiểu là 1")
        @Builder.Default
        private int quantity = 1;
    }
}
