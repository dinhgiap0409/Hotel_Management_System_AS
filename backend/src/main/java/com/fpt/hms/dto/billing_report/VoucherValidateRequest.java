package com.fpt.hms.dto.billing_report;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoucherValidateRequest {

    @NotBlank(message = "Mã voucher không được để trống")
    private String code;

    private BigDecimal subtotalAmount;
}

