package com.fpt.hms.dto.billing_report;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AdditionalChargeRequest {

    @NotBlank(message = "Loại phụ thu không được để trống")
    private String chargeType; // MINIBAR, DAMAGE, LATE_CHECKOUT, EXTRA_GUEST, OTHER

    private String description;

    @NotNull(message = "Số tiền phụ thu không được để trống")
    @DecimalMin(value = "1000", message = "Số tiền phụ thu tối thiểu là 1,000 VND")
    private BigDecimal amount;
}

