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
public class AdditionalChargeDto {
    private Integer additionalChargeId;
    private Integer folioId;
    private String chargeType;
    private String description;
    private BigDecimal amount;
    private String createdByStaffName;
    private Instant createdAt;
    private String status;
}

