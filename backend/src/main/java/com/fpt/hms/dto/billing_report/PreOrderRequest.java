package com.fpt.hms.dto.billing_report;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PreOrderRequest {

    @NotNull(message = "Mã đơn đặt phòng không được để trống")
    private Integer reservationId;

    @NotNull(message = "Mã dịch vụ không được để trống")
    private Integer serviceId;

    @NotNull(message = "Số lượng không được để trống")
    @Min(value = 1, message = "Số lượng tối thiểu là 1")
    private Integer quantity;

    private String scheduledTime;

    private String details;
}