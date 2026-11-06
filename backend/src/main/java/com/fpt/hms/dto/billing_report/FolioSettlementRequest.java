package com.fpt.hms.dto.billing_report;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FolioSettlementRequest {

    private String voucherCode;

    @NotBlank(message = "Phương thức thanh toán không được để trống (CASH, CREDIT_CARD, BANK_TRANSFER)")
    private String paymentMethod;

    private String notes;
}

