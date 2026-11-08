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
public class FolioVnPayInitResponse {
    private Integer stayId;
    private String txnRef;
    private BigDecimal amount;
    private String paymentUrl;
}

