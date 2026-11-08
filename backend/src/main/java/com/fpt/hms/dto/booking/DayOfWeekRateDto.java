package com.fpt.hms.dto.booking;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * Module 3A (Owner: GiapND) - Day-of-week tariff schedule item for UC-22.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DayOfWeekRateDto {
    private Integer dayOfWeek;
    private String dayLabel;
    private BigDecimal price;
    private Boolean isWeekendSurcharge;
}

