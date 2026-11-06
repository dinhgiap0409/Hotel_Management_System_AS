successfully downloaded text file (SHA: 9775c186f127cb88068fe73a2e9bf2bab066f07a)package com.fpt.hms.dto.room;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * UC-12: Update Room Type Request (SALES_MANAGER, ADMIN).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRoomTypeRequest {

    @NotBlank(message = "Tên hạng phòng không được để trống")
    @Size(max = 100, message = "Tên hạng phòng tối đa 100 ký tự")
    private String typeName;

    @NotNull(message = "Sức chứa tối đa không được để trống")
    @Min(value = 1, message = "Sức chứa tối đa phải ít nhất 1 người")
    private Integer capacity;

    @NotNull(message = "Giá cơ bản không được để trống")
    @DecimalMin(value = "0.01", message = "Giá cơ bản phải lớn hơn 0")
    private BigDecimal basePrice;

    @Size(max = 1000, message = "Tiện nghi tối đa 1000 ký tự")
    private String amenities;

    @Size(max = 1000, message = "Mô tả tối đa 1000 ký tự")
    private String description;

    @Size(max = 500, message = "Đường dẫn ảnh tối đa 500 ký tự")
    private String imageUrl;

    private Boolean isActive;
}

