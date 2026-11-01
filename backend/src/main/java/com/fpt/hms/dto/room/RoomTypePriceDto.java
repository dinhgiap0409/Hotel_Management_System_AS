package com.fpt.hms.dto.room;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Dynamic Pricing per Day-of-Week for Room Types.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomTypePriceDto {

    private Integer roomTypePriceId;
    private Integer roomTypeId;

    @NotNull(message = "Thứ trong tuần không được để trống (1=T2, ..., 7=CN)")
    @Min(value = 1, message = "Thứ trong tuần từ 1 (Thứ Hai) đến 7 (Chủ Nhật)")
    @Max(value = 7, message = "Thứ trong tuần từ 1 (Thứ Hai) đến 7 (Chủ Nhật)")
    private Integer dayOfWeek;

    @NotNull(message = "Đơn giá không được để trống")
    @DecimalMin(value = "0.01", message = "Đơn giá phải lớn hơn 0")
    private BigDecimal price;

    @NotNull(message = "Ngày bắt đầu áp dụng không được để trống")
    private LocalDate effectiveFrom;

    private LocalDate effectiveTo;

    private Boolean isActive;
}
