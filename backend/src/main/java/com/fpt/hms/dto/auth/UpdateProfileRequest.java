package com.fpt.hms.dto.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateProfileRequest {
    @NotBlank(message = "Họ và tên không được để trống")
    @Size(min = 2, max = 100, message = "Họ và tên từ 2 đến 100 ký tự")
    private String fullName;

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^(0|\\+84)\\d{9}$", message = "Số điện thoại Việt Nam không hợp lệ (10 chữ số)")
    private String phone;

    @Pattern(regexp = "^$|^[A-Za-z0-9]{9,12}$", message = "Số CCCD/Passport không hợp lệ (gồm 9 đến 12 ký tự chữ hoặc số)")
    private String identityNumber;

    @Size(max = 100)
    private String gender;

    private LocalDate dateOfBirth;

    @Size(max = 100)
    private String address;
}
