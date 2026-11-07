package com.fpt.hms.dto.billing_report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DepositPaymentDto {
    private Integer paymentId;
    private BigDecimal amount;
    private String paymentType;
    private String method;
    private String status;
    private Instant paidAt;
}

