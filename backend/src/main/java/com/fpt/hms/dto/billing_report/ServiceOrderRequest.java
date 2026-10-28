package com.fpt.hms.dto.billing_report;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ServiceOrderRequest {
    @NotNull(message = "Stay ID is required")
    private Integer stayId;

    @NotNull(message = "Service ID is required")
    private Integer serviceId;

    @Min(value = 1, message = "Quantity must be at least 1")
    private int quantity = 1;
}