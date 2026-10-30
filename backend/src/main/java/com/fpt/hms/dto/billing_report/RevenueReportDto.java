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
public class RevenueReportDto {
    private long totalRooms;
    private long occupiedRooms;
    private double occupancyPercentage;
    private long paidInvoicesCount;
    private BigDecimal totalSettledRevenue;
    private long activeServicesCount;
}