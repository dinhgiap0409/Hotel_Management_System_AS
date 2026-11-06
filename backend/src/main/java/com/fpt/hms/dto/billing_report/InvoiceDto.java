successfully downloaded text file (SHA: 878ca6bc765dcd3e4ff0ed1059b8fff00dc087ea)package com.fpt.hms.dto.billing_report;

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
public class InvoiceDto {
    private Integer invoiceId;
    private String invoiceCode;
    private Integer folioId;
    private BigDecimal totalAmount;
    private BigDecimal discountAmount;
    private BigDecimal taxAmount;
    private BigDecimal finalAmount;
    private String voucherCode;
    private String status;
    private Instant issueDate;
}