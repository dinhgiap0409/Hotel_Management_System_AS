package com.fpt.hms.dto.billing_report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoomNightItemDto {
    private Integer nightlyRateId;
    private LocalDate stayDate;
    private String roomTypeName;
    private Integer quantity;
    private BigDecimal unitPrice;
    private BigDecimal lineTotal;
}

