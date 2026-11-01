package com.fpt.hms.dto.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

@Data
public class AdminCreateUserRequest {
    @NotBlank(message = "Email không được để trống")
    @Email(message = "Định dạng email không hợp lệ")
    @Size(max = 254)
    private String email;

    @NotBlank(message = "Mật khẩu khởi tạo không được để trống")
    @Size(min = 8, max = 50, message = "Mật khẩu phải có ít nhất 8 ký tự")
    private String password;

    @NotBlank(message = "Họ và tên không được để trống")
    @Size(min = 2, max = 100)
    private String fullName;

    @NotBlank(message = "Số điện thoại không được để trống")
    @Pattern(regexp = "^(0|\\+84)\\d{9}$", message = "Số điện thoại Việt Nam không hợp lệ")
    private String phone;

    @NotBlank(message = "Vai trò không được để trống")
    private String roleName;

    private Integer departmentId;
    private String gender;
    private LocalDate dateOfBirth;
    private String address;
    private String identityNumber;
}
