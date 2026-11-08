package com.fpt.hms.dto.billing_report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoucherValidateResponse {
    private boolean valid;
    private String message;
    private Integer voucherId;
    private String code;
    private String discountType;
    private BigDecimal discountValue;
    private BigDecimal discountAmount;
    private BigDecimal subtotalAfterDiscount;
}

