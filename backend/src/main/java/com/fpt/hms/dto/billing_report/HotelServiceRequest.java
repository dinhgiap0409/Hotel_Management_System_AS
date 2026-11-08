package com.fpt.hms.dto.billing_report;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/**
 * Module 4 (Owner: LinhNH) - Request payload for creating/updating an ancillary service (UC-31, UC-32).
 */
@Data
public class HotelServiceRequest {

    @NotBlank(message = "Tên dịch vụ không được để trống")
    @Size(max = 100, message = "Tên dịch vụ tối đa 100 ký tự")
    private String serviceName;

    @NotBlank(message = "Nhóm dịch vụ không được để trống")
    @Size(max = 50, message = "Nhóm dịch vụ tối đa 50 ký tự")
    private String category;

    @NotBlank(message = "Đơn vị tính không được để trống")
    @Size(max = 50, message = "Đơn vị tính tối đa 50 ký tự")
    private String billingUnit;

    @NotNull(message = "Đơn giá không được để trống")
    @DecimalMin(value = "0.0", inclusive = false, message = "Đơn giá phải lớn hơn 0")
    private BigDecimal unitPrice;

    @Size(max = 500, message = "Mô tả tối đa 500 ký tự")
    private String description;
}

