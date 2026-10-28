package com.fpt.hms.integration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * VNPay Payment Gateway Integration Service (UC-23).
 */
@Service
public class VnPayGatewayService {

    @Value("${app.vnpay.pay-url}")
    private String vnpPayUrl;

    @Value("${app.vnpay.return-url}")
    private String vnpReturnUrl;

    public String createDepositPaymentUrl(String reservationCode, BigDecimal amount) {
        return vnpPayUrl + "?vnp_TxnRef=" + reservationCode
                + "&vnp_Amount=" + amount.multiply(BigDecimal.valueOf(100)).toBigInteger()
                + "&vnp_ReturnUrl=" + vnpReturnUrl;
    }
}
