package com.fpt.hms.dto.booking;

import jakarta.validation.constraints.*;
import lombok.Data;

import java.time.LocalDate;

@Data
public class CreateReservationRequest {
    @NotNull(message = "Vui lòng chọn hạng phòng cần đặt")
    private Integer roomTypeId;

    @NotNull(message = "Vui lòng chọn ngày nhận phòng (Check-in)")
    private LocalDate checkInDate;

    @NotNull(message = "Vui lòng chọn ngày trả phòng (Check-out)")
    private LocalDate checkOutDate;

    @Min(value = 1, message = "Số lượng khách phải từ 1 người trở lên")
    private int guestCount = 1;

    @Min(value = 1, message = "Số lượng phòng đặt phải từ 1 phòng trở lên")
    private int quantity = 1;

    @NotBlank(message = "Họ và tên người liên hệ không được để trống")
    @Size(max = 100, message = "Họ và tên tối đa 100 ký tự")
    private String contactName;

    @NotBlank(message = "Email liên hệ không được để trống")
    @Email(message = "Định dạng Email không hợp lệ")
    private String contactEmail;

    @NotBlank(message = "Số điện thoại liên hệ không được để trống")
    @Pattern(regexp = "^(0|\\+84)\\d{9}$", message = "Số điện thoại Việt Nam không hợp lệ (10 chữ số, bắt đầu bằng 0 hoặc +84)")
    private String contactPhone;

    @Size(max = 500, message = "Ghi chú đặc biệt tối đa 500 ký tự")
    private String specialNotes;
}
